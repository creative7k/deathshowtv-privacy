export type Camera = {
  id: string;
  category?: string;
  feed_kind: 'hls' | 'image';
  feed_url: string | null;
  page_url: string | null;
  refresh_sec: number | null;
  schedule: 'continuous' | 'ooi-every-3h' | null;
  lat?: number | null;
  lon?: number | null;
  /** Recorded continuously; the thousands of others are only recorded when an alert hits them. */
  featured?: boolean;
};

/** Row written by the catalogue import. */
export type CameraUpsert = {
  id: string;
  category: string;
  name: string;
  place: string;
  feed_kind: 'hls' | 'image';
  feed_url: string;
  page_url: string | null;
  refresh_sec: number | null;
  schedule: 'continuous' | null;
  credit: string;
  licence: string;
  lat: number;
  lon: number;
  source: string;
  active: boolean;
};

export type PendingEvent = {
  id: string;
  camera_id: string;
  started_at: string;
  origin?: 'user' | 'ai' | 'alert';
};

export type NewAlertEvent = {
  camera_id: string;
  title: string;
  description: string;
  alert_source: string;
  alert_ref: string;
  alert_level: 1 | 2 | 3;
  paranormal: boolean;
};

/** Database access used by the worker (implemented with Supabase, faked in tests). */
export interface EventStore {
  listCameras(): Promise<Camera[]>;
  /** Published events from the last `sinceMs` that have no clip yet. */
  listPendingEvents(sinceMs: number): Promise<PendingEvent[]>;
  setClip(eventId: string, clipUrl: string, posterUrl: string): Promise<void>;
  /** Publishes an event for an official alert; null when that alert already has one. */
  createAlertEvent(ev: NewAlertEvent): Promise<string | null>;
  /** Ends the "alert" highlight of alert events older than `olderThanMs`. */
  expireAlerts(olderThanMs: number): Promise<void>;
  upsertCameras(rows: CameraUpsert[]): Promise<void>;
}

/** Where clips are published (S3-compatible bucket in production, a folder in dev/tests). */
export interface MediaStorage {
  put(key: string, file: string, contentType: string): Promise<string>;
  /** Deletes clips and posters older than `maxAgeMs` (free plans have little storage). Optional. */
  prune?(maxAgeMs: number): Promise<number>;
}

export type Logger = (msg: string, extra?: Record<string, unknown>) => void;
