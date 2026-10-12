import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { imageWindow, type FrameBuffer } from './frames.ts';
import { joinSegments, poster, timelapse } from './ffmpeg.ts';
import { SEGMENT_SEC, segmentsBetween } from './hls.ts';
import type { Camera, EventStore, Logger, MediaStorage, PendingEvent } from './types.ts';

const HLS_BEFORE_MS = 30_000;
const HLS_AFTER_MS = 15_000;
/** Alerts are recorded from the moment they land: the replay covers the minute that follows. */
const HLS_ALERT_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 3;
const MIN_FRAMES = 2;

export type CameraSources = {
  camera: Camera;
  frames?: FrameBuffer;
  /** Folder of the HLS segment ring. */
  hlsDir?: string;
};

/**
 * Turns pending events into clips: waits until the post-event window has been captured,
 * builds the MP4 + poster, publishes them, then records the URLs on the event.
 */
export class Clipper {
  private readonly attempts = new Map<string, number>();
  private readonly store: EventStore;
  private readonly storage: MediaStorage;
  private readonly sources: Map<string, CameraSources>;
  private readonly workDir: string;
  private readonly log: Logger;

  constructor(store: EventStore, storage: MediaStorage, sources: Map<string, CameraSources>, workDir: string, log: Logger) {
    this.store = store;
    this.storage = storage;
    this.sources = sources;
    this.workDir = workDir;
    this.log = log;
  }

  /** One pass over pending events. Returns the ids that got a clip. */
  async runOnce(now = Date.now()): Promise<string[]> {
    const done: string[] = [];
    for (const ev of await this.store.listPendingEvents(6 * 3_600_000)) {
      if ((this.attempts.get(ev.id) ?? 0) >= MAX_ATTEMPTS) continue;
      const src = this.sources.get(ev.camera_id);
      if (!src) continue;
      const started = Date.parse(ev.started_at);
      const win = this.window(src.camera, ev.origin);
      if (now < started + win.afterMs) continue; // post-event footage not captured yet

      try {
        const ok = await this.clipEvent(ev, src, started - win.beforeMs, started + win.afterMs);
        if (ok) done.push(ev.id);
        else this.attempts.set(ev.id, MAX_ATTEMPTS); // nothing recorded for that window: give up
      } catch (e) {
        const n = (this.attempts.get(ev.id) ?? 0) + 1;
        this.attempts.set(ev.id, n);
        this.log('clip failed', { event: ev.id, attempt: n, error: String(e) });
      }
    }
    return done;
  }

  private window(camera: Camera, origin?: PendingEvent['origin']): { beforeMs: number; afterMs: number } {
    if (camera.feed_kind === 'hls') {
      return { beforeMs: HLS_BEFORE_MS, afterMs: origin === 'alert' ? HLS_ALERT_AFTER_MS : HLS_AFTER_MS };
    }
    return imageWindow(camera.refresh_sec ?? 60);
  }

  private async clipEvent(ev: PendingEvent, src: CameraSources, from: number, to: number): Promise<boolean> {
    const dir = path.join(this.workDir, ev.id);
    await mkdir(dir, { recursive: true });
    const video = path.join(dir, 'clip.mp4');
    const still = path.join(dir, 'poster.jpg');
    try {
      if (src.camera.feed_kind === 'hls') {
        // A segment's mtime is when it finished: include the one covering `from`.
        const segs = src.hlsDir ? await segmentsBetween(src.hlsDir, from, to + SEGMENT_SEC * 1000) : [];
        if (segs.length === 0) {
          this.log('no recorded video for event', { event: ev.id, camera: src.camera.id });
          return false;
        }
        await joinSegments(segs, video, path.join(dir, 'list.txt'));
      } else {
        const frames = src.frames ? await src.frames.list(from, to) : [];
        if (frames.length < MIN_FRAMES) {
          this.log('not enough frames for event', { event: ev.id, camera: src.camera.id, frames: frames.length });
          return false;
        }
        await timelapse(frames.map((f) => f.file), video, path.join(dir, 'list.txt'));
      }
      await poster(video, still);
      const clipUrl = await this.storage.put(`clips/${ev.id}.mp4`, video, 'video/mp4');
      const posterUrl = await this.storage.put(`posters/${ev.id}.jpg`, still, 'image/jpeg');
      await this.store.setClip(ev.id, clipUrl, posterUrl);
      this.log('clip published', { event: ev.id, camera: src.camera.id, clipUrl });
      return true;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
