import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { FrameBuffer, imageWindow } from '../src/frames.ts';
import { findWebcamImage } from '../src/resolve.ts';
import { makeJpegs, tempDir } from './helpers.ts';

test('identical consecutive images are stored once', async () => {
  const dir = await tempDir('frames');
  const [a, b] = await makeJpegs(dir, 2);
  const buf = new FrameBuffer(path.join(dir, 'buf'), 3_600_000);
  assert.equal(await buf.add(a, 1000), true);
  assert.equal(await buf.add(a, 2000), false);
  assert.equal(await buf.add(b, 3000), true);
  assert.deepEqual((await buf.list(0, 10_000)).map((f) => f.at), [1000, 3000]);
});

test('frames older than the retention are pruned, list honours the window', async () => {
  const dir = await tempDir('frames');
  const imgs = await makeJpegs(dir, 3);
  const buf = new FrameBuffer(path.join(dir, 'buf'), 60_000);
  await buf.add(imgs[0], 0);
  await buf.add(imgs[1], 30_000);
  await buf.add(imgs[2], 100_000);
  assert.deepEqual((await readdir(path.join(dir, 'buf'))).sort(), ['100000.jpg']);
  assert.deepEqual(await buf.list(0, 99_999), []);
});

test('time-lapse window scales with the camera refresh rate', () => {
  assert.deepEqual(imageWindow(30), { beforeMs: 600_000, afterMs: 180_000, retentionMs: 2_580_000 });
  const goes = imageWindow(600); // satellite image every 10 min
  assert.equal(goes.beforeMs, 3 * 3_600_000);
  assert.equal(goes.afterMs, 3_600_000);
});

test('webcam image is found on an HTML page', () => {
  const html = `<img src="/logo.jpg"><img alt="cam" src="SouthPoleWebcam/SP00012.jpg?x=1">`;
  assert.equal(
    findWebcamImage(html, 'https://www.usap.gov/videoclipsandmaps/spwebcam.cfm'),
    'https://www.usap.gov/videoclipsandmaps/SouthPoleWebcam/SP00012.jpg?x=1',
  );
  assert.equal(findWebcamImage('<img src="/logo.jpg">', 'https://example.gov/'), null);
});

test('storage pruning selects only objects older than the cutoff', async () => {
  const { expired } = await import('../src/storage.ts');
  const objects = [
    { name: 'old.mp4', created_at: '2026-10-01T00:00:00Z' },
    { name: 'new.mp4', created_at: '2026-10-10T00:00:00Z' },
    { name: 'folder', created_at: null },
  ];
  assert.deepEqual(expired(objects, Date.parse('2026-10-05T00:00:00Z')), ['old.mp4']);
});
