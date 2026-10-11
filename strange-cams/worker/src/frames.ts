import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type Frame = { at: number; file: string };

/**
 * Rolling on-disk history of still images for one camera.
 * Files are named by capture time; identical consecutive images are skipped
 * (most sources re-serve the same JPEG until their next capture).
 */
export class FrameBuffer {
  private lastHash: string | null = null;
  private readonly dir: string;
  private readonly retentionMs: number;

  constructor(dir: string, retentionMs: number) {
    this.dir = dir;
    this.retentionMs = retentionMs;
  }

  /** Stores the image; returns false when it is identical to the previous one. */
  async add(image: Buffer, at: number): Promise<boolean> {
    const hash = createHash('sha1').update(image).digest('hex');
    if (hash === this.lastHash) return false;
    this.lastHash = hash;
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, `${at}.jpg`), image);
    await this.prune(at);
    return true;
  }

  async list(from: number, to: number): Promise<Frame[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    return names
      .filter((n) => n.endsWith('.jpg'))
      .map((n) => ({ at: Number(n.slice(0, -4)), file: path.join(this.dir, n) }))
      .filter((f) => Number.isFinite(f.at) && f.at >= from && f.at <= to)
      .sort((a, b) => a.at - b.at);
  }

  private async prune(now: number): Promise<void> {
    const old = await this.list(0, now - this.retentionMs);
    await Promise.all(old.map((f) => rm(f.file, { force: true })));
  }
}

/** Clip window for an image camera: enough frames before/after the event for a few seconds of time-lapse. */
export function imageWindow(refreshSec: number): { beforeMs: number; afterMs: number; retentionMs: number } {
  const step = Math.max(10, refreshSec) * 1000;
  const beforeMs = Math.min(Math.max(18 * step, 10 * 60_000), 4 * 3_600_000);
  const afterMs = Math.min(Math.max(6 * step, 2 * 60_000), 3_600_000);
  return { beforeMs, afterMs, retentionMs: beforeMs + afterMs + 30 * 60_000 };
}
