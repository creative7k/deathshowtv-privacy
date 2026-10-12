import { insideRing, nearest } from '../geo.ts';
import type { Camera, EventStore, Logger } from '../types.ts';
import type { Alert } from './types.ts';

/** How far from the alert a camera may be to film it. */
const RADIUS_KM: Record<Alert['kind'], number> = {
  accident: 1.5,
  fire: 2,
  hazard: 1,
  flood: 2,
  quake: 100,
  weather: 0, // must be inside the warned area
  aurora: 0, // any aurora camera
};

/** Alerts older than this when first seen are ignored: we can no longer film them. */
const MAX_AGE_MS = 30 * 60_000;
/** How long a camera is recorded after an alert lands on it. */
export const ALERT_RECORDING_MS = 4 * 60_000;
/** One camera, one event: CHP often logs the same incident several times (one per caller/unit). */
const CAMERA_COOLDOWN_MS = 15 * 60_000;

export function pickCamera(alert: Alert, cameras: Camera[]): Camera | null {
  if (alert.kind === 'aurora') {
    return cameras.find((c) => c.category === 'aurores' && c.feed_url) ?? null;
  }
  if (alert.kind === 'weather') {
    const inside = cameras.filter(
      (c) => c.lat != null && c.lon != null && alert.area?.some((ring) => insideRing({ lat: c.lat!, lon: c.lon! }, ring)),
    );
    // Prefer real video, then featured cameras.
    return inside.sort((a, b) => score(b) - score(a))[0] ?? null;
  }
  if (alert.lat === undefined || alert.lon === undefined) return null;
  const withFeed = cameras.filter((c) => c.feed_url);
  return nearest(withFeed, { lat: alert.lat, lon: alert.lon }, RADIUS_KM[alert.kind])?.item ?? null;
}

const score = (c: Camera) => (c.feed_kind === 'hls' ? 2 : 0) + (c.featured ? 1 : 0);

/**
 * Turns official alerts into feed events: finds the camera that can film it, publishes the event
 * right away (the app shows that camera live) and starts recording it for the replay.
 */
export class AlertDispatcher {
  private readonly seen = new Set<string>();
  private readonly lastOnCamera = new Map<string, number>();
  private readonly store: EventStore;
  private readonly startRecording: (camera: Camera) => void;
  private readonly log: Logger;

  constructor(store: EventStore, startRecording: (camera: Camera) => void, log: Logger) {
    this.store = store;
    this.startRecording = startRecording;
    this.log = log;
  }

  /** Returns the ids of the events created. */
  async handle(alerts: Alert[], cameras: Camera[], now = Date.now()): Promise<string[]> {
    const created: string[] = [];
    for (const alert of alerts) {
      const key = `${alert.source}:${alert.ref}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      if (now - alert.at > MAX_AGE_MS) continue;

      const camera = pickCamera(alert, cameras);
      if (!camera) continue;
      if (now - (this.lastOnCamera.get(camera.id) ?? -Infinity) < CAMERA_COOLDOWN_MS) continue;

      const id = await this.store.createAlertEvent({
        camera_id: camera.id,
        title: alert.title,
        description: alert.description,
        alert_source: alert.source,
        alert_ref: alert.ref,
        alert_level: alert.level,
        paranormal: false,
      });
      if (!id) continue; // already published (e.g. after a restart)
      this.lastOnCamera.set(camera.id, now);
      this.startRecording(camera);
      created.push(id);
      this.log('alert published', { event: id, source: alert.source, kind: alert.kind, camera: camera.id });
    }
    return created;
  }
}
