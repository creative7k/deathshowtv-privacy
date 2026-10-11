/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVoteDelta, rowToCamera, rowToEvent, type CameraRow, type EventRow } from './mappers.ts';

const event = rowToEvent({
  id: 'e1',
  camera_id: 'usgs-v1cam',
  origin: 'user',
  title: 'Activité volcanique',
  description: '',
  paranormal: false,
  started_at: '2026-10-11T10:00:00Z',
  votes_up: 10,
  votes_down: 2,
  alert_level: 7,
  alert_active: false,
} satisfies EventRow);

test('event rows are converted and alert level is clamped', () => {
  assert.equal(event.startedAt, Date.parse('2026-10-11T10:00:00Z'));
  assert.equal(event.alertLevel, 3);
  assert.equal(event.cameraId, 'usgs-v1cam');
});

test('camera rows map to the right feed kind', () => {
  const base: CameraRow = {
    id: 'c', category: 'aurores', name: 'n', place: 'p', feed_kind: 'image', feed_url: null,
    page_url: 'https://example.gov', refresh_sec: null, schedule: null, credit: 'USAP', licence: 'Domaine public',
  };
  assert.deepEqual(rowToCamera(base).feed, { kind: 'image', url: null, pageUrl: 'https://example.gov', refreshSec: 60 });
  const hls = rowToCamera({ ...base, feed_kind: 'hls', feed_url: 'https://x/playlist.m3u8', schedule: 'ooi-every-3h' });
  assert.deepEqual(hls.feed, { kind: 'hls', url: 'https://x/playlist.m3u8', schedule: 'ooi-every-3h' });
});

test('vote deltas: new vote, flip, removal', () => {
  assert.deepEqual([applyVoteDelta(event, 0, 1).votesUp, applyVoteDelta(event, 0, 1).votesDown], [11, 2]);
  const flipped = applyVoteDelta(event, 1, -1);
  assert.deepEqual([flipped.votesUp, flipped.votesDown], [9, 3]);
  const removed = applyVoteDelta(event, -1, 0);
  assert.deepEqual([removed.votesUp, removed.votesDown], [10, 1]);
});
