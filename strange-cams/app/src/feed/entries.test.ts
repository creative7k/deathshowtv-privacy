/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntries } from './entries.ts';
import type { Camera, FeedEvent } from '../types.ts';

const cam = (id: string, category: Camera['category'], kind: 'hls' | 'image'): Camera => ({
  id,
  category,
  name: id,
  place: '',
  credit: '',
  licence: '',
  feed: kind === 'hls' ? { kind, url: 'u' } : { kind, url: 'u', pageUrl: '', refreshSec: 60 },
});
const cameras = Object.fromEntries(
  [cam('volcan', 'volcans', 'image'), cam('route', 'urbain', 'hls'), cam('pole', 'aurores', 'image')].map((c) => [c.id, c]),
);
const ev = (id: string, cameraId: string, paranormal = false): FeedEvent => ({
  id, cameraId, paranormal, origin: 'user', title: id, description: '', startedAt: 0,
  votesUp: 0, votesDown: 0, alertLevel: 0, alertActive: false,
});

test('events first, then every camera with live video first', () => {
  const keys = buildEntries([ev('e1', 'volcan')], cameras, null).map((e) => e.key);
  assert.deepEqual(keys, ['event:e1', 'camera:route', 'camera:volcan', 'camera:pole']);
});

test('a quiet category still shows its cameras', () => {
  assert.deepEqual(buildEntries([], cameras, 'aurores').map((e) => e.key), ['camera:pole']);
});

test('paranormal lists strange events only, never plain cameras', () => {
  const keys = buildEntries([ev('e1', 'volcan'), ev('e2', 'pole', true)], cameras, 'paranormal').map((e) => e.key);
  assert.deepEqual(keys, ['event:e2']);
});

test('events whose camera is unknown are skipped', () => {
  assert.deepEqual(buildEntries([ev('x', 'gone')], cameras, 'volcans').map((e) => e.key), ['camera:volcan']);
});
