import path from 'node:path';
import type { CameraSources } from './clipper.ts';
import { FrameBuffer, imageWindow } from './frames.ts';
import { HlsRecorder } from './hls.ts';
import { ImagePoller } from './poller.ts';
import type { Camera, Logger } from './types.ts';

type Active = { stop: () => void; until: number };

/**
 * Starts and stops capture per camera. Featured cameras are captured all the time;
 * any other camera is captured on demand, for a few minutes, as soon as an alert lands on it.
 */
export class RecordingPool {
  readonly sources = new Map<string, CameraSources>();
  private readonly active = new Map<string, Active>();
  private readonly dataDir: string;
  private readonly log: Logger;

  constructor(dataDir: string, log: Logger) {
    this.dataDir = dataDir;
    this.log = log;
    setInterval(() => this.sweep(), 15_000).unref();
  }

  /** Captures `camera` for at least `durationMs` (Infinity = always). */
  ensure(camera: Camera, durationMs: number): void {
    const until = Date.now() + durationMs;
    const current = this.active.get(camera.id);
    if (current) {
      current.until = Math.max(current.until, until);
      return;
    }
    const src: CameraSources = this.sources.get(camera.id) ?? { camera };
    this.sources.set(camera.id, src);
    if (!camera.feed_url) return;

    if (camera.feed_kind === 'hls') {
      src.hlsDir = path.join(this.dataDir, 'hls', camera.id);
      const rec = new HlsRecorder(camera.feed_url, src.hlsDir, this.log);
      void rec.start();
      this.active.set(camera.id, { stop: () => rec.stop(), until });
    } else {
      const refresh = camera.refresh_sec ?? 60;
      src.frames ??= new FrameBuffer(path.join(this.dataDir, 'frames', camera.id), imageWindow(refresh).retentionMs);
      const poller = new ImagePoller(camera.id, camera.feed_url, refresh, src.frames, this.log);
      poller.start();
      this.active.set(camera.id, { stop: () => poller.stop(), until });
    }
    if (Number.isFinite(durationMs)) this.log('recording started', { camera: camera.id, minutes: Math.round(durationMs / 60_000) });
  }

  isRecording(cameraId: string): boolean {
    return this.active.has(cameraId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, a] of this.active) {
      if (a.until > now) continue;
      a.stop();
      this.active.delete(id);
    }
  }
}
