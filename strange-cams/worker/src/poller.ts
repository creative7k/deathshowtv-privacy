import type { FrameBuffer } from './frames.ts';
import type { Logger } from './types.ts';

const USER_AGENT = 'StrangeCams-Ingest/0.1 (+contact: set INGEST_CONTACT)';

export async function fetchImage(url: string, timeoutMs = 20_000): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'user-agent': process.env.INGEST_CONTACT ? `StrangeCams-Ingest/0.1 (${process.env.INGEST_CONTACT})` : USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content-type'})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Polls one still-image camera at its own refresh rate (never faster than every 10 s,
 * to stay a polite client of public institutions' servers).
 */
export class ImagePoller {
  private timer: NodeJS.Timeout | null = null;
  private failures = 0;
  private readonly cameraId: string;
  private readonly url: string;
  private readonly refreshSec: number;
  private readonly buffer: FrameBuffer;
  private readonly log: Logger;

  constructor(cameraId: string, url: string, refreshSec: number, buffer: FrameBuffer, log: Logger) {
    this.cameraId = cameraId;
    this.url = url;
    this.refreshSec = refreshSec;
    this.buffer = buffer;
    this.log = log;
  }

  start(): void {
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    const base = Math.max(10, this.refreshSec) * 1000;
    try {
      await this.buffer.add(await fetchImage(this.url), Date.now());
      this.failures = 0;
    } catch (e) {
      this.failures++;
      if (this.failures === 1 || this.failures % 20 === 0) {
        this.log('image fetch failed', { camera: this.cameraId, failures: this.failures, error: String(e) });
      }
    }
    const delay = this.failures === 0 ? base : Math.min(base * 2 ** Math.min(this.failures, 5), 15 * 60_000);
    this.timer = setTimeout(() => void this.tick(), delay);
  }
}
