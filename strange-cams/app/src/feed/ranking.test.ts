/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderFeed, spectacleScore } from './ranking.ts';
import type { FeedEvent } from '../types.ts';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

const ev = (id: string, over: Partial<FeedEvent> = {}): FeedEvent => ({
  id,
  cameraId: 'cam',
  paranormal: false,
  origin: 'user',
  title: id,
  description: '',
  startedAt: NOW - 10 * MIN,
  votesUp: 10,
  votesDown: 0,
  alertLevel: 0,
  alertActive: false,
  ...over,
});

test('most spectacular event comes first', () => {
  const feed = orderFeed([ev('a'), ev('b', { votesUp: 500 }), ev('c')], NOW, () => 0);
  assert.equal(feed[0].id, 'b');
});

test('fresh event beats an older one with slightly more votes', () => {
  const fresh = ev('fresh', { votesUp: 100, startedAt: NOW - 5 * MIN });
  const old = ev('old', { votesUp: 150, startedAt: NOW - 6 * 60 * MIN });
  assert.ok(spectacleScore(fresh, NOW) > spectacleScore(old, NOW));
});

test('active alerts follow, highest level first, inactive alerts are ignored', () => {
  const feed = orderFeed(
    [
      ev('top', { votesUp: 900 }),
      ev('low', { alertActive: true, alertLevel: 1 }),
      ev('high', { alertActive: true, alertLevel: 3 }),
      ev('ended', { alertActive: false, alertLevel: 3 }),
      ev('plain'),
    ],
    NOW,
    () => 0,
  );
  assert.deepEqual(feed.slice(0, 3).map((e) => e.id), ['top', 'high', 'low']);
  assert.equal(feed.length, 5);
});

test('empty feed', () => {
  assert.deepEqual(orderFeed([], NOW), []);
});
