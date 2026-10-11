import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from '../src/ffmpeg.ts';
import type { Camera, EventStore, PendingEvent } from '../src/types.ts';

export const tempDir = (prefix: string) => mkdtemp(path.join(tmpdir(), `sc-${prefix}-`));

/** N distinct 640x360 JPEGs (ffmpeg test pattern, one frame per second of the pattern). */
export async function makeJpegs(dir: string, n: number): Promise<Buffer[]> {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=size=640x360:rate=1:duration=${n}`, path.join(dir, 'src%02d.jpg')]);
  return Promise.all(Array.from({ length: n }, (_, i) => readFile(path.join(dir, `src${String(i + 1).padStart(2, '0')}.jpg`))));
}

export class FakeStore implements EventStore {
  cameras: Camera[] = [];
  events: (PendingEvent & { clip_url?: string; poster_url?: string })[] = [];

  async listCameras() {
    return this.cameras;
  }
  async listPendingEvents() {
    return this.events.filter((e) => !e.clip_url);
  }
  async setClip(id: string, clipUrl: string, posterUrl: string) {
    const ev = this.events.find((e) => e.id === id)!;
    ev.clip_url = clipUrl;
    ev.poster_url = posterUrl;
  }
}

export const silentLog = () => {};
