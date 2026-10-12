import type { Camera, CategoryId, FeedEvent } from '../types';

export type FeedEntry =
  | { type: 'event'; key: string; event: FeedEvent; camera: Camera }
  | { type: 'camera'; key: string; camera: Camera };

const CATEGORY_ORDER: CategoryId[] = ['urbain', 'volcans', 'espace', 'fonds-marins', 'faune', 'aurores', 'frontieres'];

/**
 * What the feed shows: events first (already ranked), then every camera live, so people
 * can watch and report — that is how the first events of a quiet day are born.
 * Real video streams come first among cameras, then still-image cameras by category.
 * Paranormal has no cameras of its own: it only lists events.
 */
export function buildEntries(
  events: FeedEvent[],
  cameras: Record<string, Camera>,
  category: CategoryId | null,
): FeedEntry[] {
  const inCategory = (c: Camera) => category === null || c.category === category;

  const eventEntries: FeedEntry[] = [];
  for (const event of events) {
    const camera = cameras[event.cameraId];
    if (!camera) continue;
    const keep = category === 'paranormal' ? event.paranormal : inCategory(camera);
    if (keep) eventEntries.push({ type: 'event', key: `event:${event.id}`, event, camera });
  }
  if (category === 'paranormal') return eventEntries;

  const rank = (c: Camera) => (c.feed.kind === 'hls' ? 0 : 1) * 100 + CATEGORY_ORDER.indexOf(c.category);
  const cameraEntries: FeedEntry[] = Object.values(cameras)
    .filter(inCategory)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map((camera) => ({ type: 'camera', key: `camera:${camera.id}`, camera }));

  return [...eventEntries, ...cameraEntries];
}
