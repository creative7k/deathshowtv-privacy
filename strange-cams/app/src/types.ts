export type CategoryId =
  | 'faune'
  | 'volcans'
  | 'aurores'
  | 'urbain'
  | 'espace'
  | 'fonds-marins'
  | 'frontieres'
  | 'paranormal';

export type Category = {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
};

/** How a camera delivers pictures: a real HLS stream, or a still image refreshed periodically. */
export type CameraFeed =
  | { kind: 'hls'; url: string; schedule?: 'continuous' | 'ooi-every-3h' }
  | {
      kind: 'image';
      /** Direct JPEG URL, or null until the ingest worker resolves it from `pageUrl`. */
      url: string | null;
      pageUrl: string;
      refreshSec: number;
    };

export type Camera = {
  id: string;
  category: Exclude<CategoryId, 'paranormal'>;
  name: string;
  place: string;
  feed: CameraFeed;
  /** Text credit shown on screen. Never a logo. */
  credit: string;
  licence: string;
};

export type EventOrigin = 'user' | 'ai';

export type FeedEvent = {
  id: string;
  cameraId: string;
  /** Primary category comes from the camera; Paranormal is an extra tag. */
  paranormal: boolean;
  origin: EventOrigin;
  title: string;
  description: string;
  startedAt: number;
  votesUp: number;
  votesDown: number;
  /** 0 = no alert, 1..3 = collective alert level (phase 2). */
  alertLevel: 0 | 1 | 2 | 3;
  alertActive: boolean;
  /** Clip of the moment (time-lapse or recorded live), produced by the ingest worker. */
  clipUrl?: string | null;
  posterUrl?: string | null;
};

export type ReportType =
  | 'animal'
  | 'lumiere'
  | 'meteo'
  | 'eruption'
  | 'trafic'
  | 'inexplique'
  | 'autre';
