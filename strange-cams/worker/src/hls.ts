import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from './types.ts';

export const SEGMENT_SEC = 4;
const RING_SEGMENTS = 45; // ~3 minutes of history

/**
 * Keeps the last few minutes of a live HLS stream on disk (ffmpeg segment ring, no re-encode),
 * so a clip can include what happened *before* someone pressed "report".
 * One upstream connection per camera, whatever the number of viewers.
 */
export class HlsRecorder {
  private proc: ChildProcess | null = null;
  private stopped = false;
  private backoffMs = 5_000;
  private readonly url: string;
  private readonly dir: string;
  private readonly log: Logger;

  constructor(url: string, dir: string, log: Logger) {
    this.url = url;
    this.dir = dir;
    this.log = log;
  }

  async start(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    this.spawn();
  }

  stop(): void {
    this.stopped = true;
    this.proc?.kill('SIGTERM');
  }

  private spawn(): void {
    if (this.stopped) return;
    const startedAt = Date.now();
    const p = spawn('ffmpeg', [
      '-loglevel', 'error', '-rw_timeout', '15000000', '-i', this.url,
      '-map', '0:v:0', '-c', 'copy', '-an',
      '-f', 'segment', '-segment_time', String(SEGMENT_SEC), '-segment_wrap', String(RING_SEGMENTS),
      '-reset_timestamps', '1', path.join(this.dir, 'seg%03d.ts'),
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    this.proc = p;
    let err = '';
    p.stderr?.on('data', (d) => (err = (err + d).slice(-500)));
    p.on('close', (code) => {
      this.proc = null;
      if (this.stopped) return;
      // Streams drop (or, for OOI, are only on air a few minutes every 3 h): retry with backoff.
      if (Date.now() - startedAt > 60_000) this.backoffMs = 5_000;
      this.log('hls recorder exited', { url: this.url, code, err: err.trim(), retryInMs: this.backoffMs });
      setTimeout(() => this.spawn(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, 5 * 60_000);
    });
  }
}

/** Finished segments written between `from` and `to`, oldest first (by modification time). */
export async function segmentsBetween(dir: string, from: number, to: number): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const withTimes = await Promise.all(
    names
      .filter((n) => n.endsWith('.ts'))
      .map(async (n) => ({ file: path.join(dir, n), mtime: (await stat(path.join(dir, n))).mtimeMs })),
  );
  return withTimes
    .filter((s) => s.mtime >= from && s.mtime <= to)
    .sort((a, b) => a.mtime - b.mtime)
    .map((s) => s.file);
}
