import type { Camera, CameraFeed, FeedEvent } from '../types';

export type CameraRow = {
  id: string;
  category: Camera['category'];
  name: string;
  place: string;
  feed_kind: 'hls' | 'image';
  feed_url: string | null;
  page_url: string | null;
  refresh_sec: number | null;
  schedule: 'continuous' | 'ooi-every-3h' | null;
  credit: string;
  licence: string;
};

export type EventRow = {
  id: string;
  camera_id: string;
  origin: FeedEvent['origin'];
  title: string;
  description: string;
  paranormal: boolean;
  started_at: string;
  votes_up: number;
  votes_down: number;
  alert_level: number;
  alert_active: boolean;
};

export function rowToCamera(r: CameraRow): Camera {
  const feed: CameraFeed =
    r.feed_kind === 'hls'
      ? { kind: 'hls', url: r.feed_url ?? '', schedule: r.schedule ?? 'continuous' }
      : { kind: 'image', url: r.feed_url, pageUrl: r.page_url ?? '', refreshSec: r.refresh_sec ?? 60 };
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    place: r.place,
    feed,
    credit: r.credit,
    licence: r.licence,
  };
}

export function rowToEvent(r: EventRow): FeedEvent {
  return {
    id: r.id,
    cameraId: r.camera_id,
    paranormal: r.paranormal,
    origin: r.origin,
    title: r.title,
    description: r.description,
    startedAt: Date.parse(r.started_at),
    votesUp: r.votes_up,
    votesDown: r.votes_down,
    alertLevel: Math.max(0, Math.min(3, r.alert_level)) as FeedEvent['alertLevel'],
    alertActive: r.alert_active,
  };
}

/** Applies a vote change to an event's counters (optimistic update). */
export function applyVoteDelta(e: FeedEvent, from: -1 | 0 | 1, to: -1 | 0 | 1): FeedEvent {
  return {
    ...e,
    votesUp: e.votesUp - (from === 1 ? 1 : 0) + (to === 1 ? 1 : 0),
    votesDown: e.votesDown - (from === -1 ? 1 : 0) + (to === -1 ? 1 : 0),
  };
}
