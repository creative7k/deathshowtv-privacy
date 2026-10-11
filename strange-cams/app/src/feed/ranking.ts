import type { FeedEvent } from '../types';

const HOUR = 3_600_000;

/**
 * "Spectacular" score: net votes with a confidence bonus, decayed by age
 * (half-life of 2 h), so a fresh event beats an old one with slightly more votes.
 */
export function spectacleScore(e: FeedEvent, now: number): number {
  const net = e.votesUp - e.votesDown;
  const total = e.votesUp + e.votesDown;
  const approval = total === 0 ? 0 : e.votesUp / total;
  const ageHours = Math.max(0, now - e.startedAt) / HOUR;
  return net * approval * Math.pow(0.5, ageHours / 2);
}

/**
 * Feed order when the app opens:
 * 1. the most spectacular event of the moment,
 * 2. active collective alerts, highest level first,
 * 3. everything else in random order.
 */
export function orderFeed(
  events: FeedEvent[],
  now: number,
  random: () => number = Math.random,
): FeedEvent[] {
  if (events.length === 0) return [];

  const top = events.reduce((best, e) =>
    spectacleScore(e, now) > spectacleScore(best, now) ? e : best,
  );
  const rest = events.filter((e) => e !== top);

  const alerts = rest
    .filter((e) => e.alertActive && e.alertLevel > 0)
    .sort((a, b) => b.alertLevel - a.alertLevel || b.startedAt - a.startedAt);

  const others = rest.filter((e) => !alerts.includes(e));
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  return [top, ...alerts, ...others];
}
