export type Camera = {
  id: string;
  feed_kind: 'hls' | 'image';
  feed_url: string | null;
  page_url: string | null;
  refresh_sec: number | null;
  schedule: 'continuous' | 'ooi-every-3h' | null;
};

export type PendingEvent = {
  id: string;
  camera_id: string;
  started_at: string;
};

/** Database access used by the worker (implemented with Supabase, faked in tests). */
export interface EventStore {
  listCameras(): Promise<Camera[]>;
  /** Published events from the last `sinceMs` that have no clip yet. */
  listPendingEvents(sinceMs: number): Promise<PendingEvent[]>;
  setClip(eventId: string, clipUrl: string, posterUrl: string): Promise<void>;
}

/** Where clips are published (S3-compatible bucket in production, a folder in dev/tests). */
export interface MediaStorage {
  put(key: string, file: string, contentType: string): Promise<string>;
}

export type Logger = (msg: string, extra?: Record<string, unknown>) => void;
