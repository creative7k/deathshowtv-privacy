import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Clipper, type CameraSources } from '../src/clipper.ts';
import { durationSec } from '../src/ffmpeg.ts';
import { FrameBuffer } from '../src/frames.ts';
import { HlsRecorder } from '../src/hls.ts';
import { LocalStorage } from '../src/storage.ts';
import { FakeStore, makeJpegs, silentLog, tempDir } from './helpers.ts';

test('image camera: frames around the event become a published time-lapse clip', async () => {
  const dir = await tempDir('clip-img');
  const store = new FakeStore();
  store.cameras = [{ id: 'cam', feed_kind: 'image', feed_url: 'x', page_url: null, refresh_sec: 30, schedule: null }];
  const started = 1_000_000_000;
  store.events = [{ id: 'ev1', camera_id: 'cam', started_at: new Date(started).toISOString() }];

  const frames = new FrameBuffer(path.join(dir, 'frames'), 24 * 3_600_000);
  const imgs = await makeJpegs(dir, 12);
  for (let i = 0; i < imgs.length; i++) await frames.add(imgs[i], started - 5 * 60_000 + i * 30_000);

  const sources = new Map<string, CameraSources>([['cam', { camera: store.cameras[0], frames }]]);
  const clipper = new Clipper(store, new LocalStorage(path.join(dir, 'media'), 'https://media.example'), sources, path.join(dir, 'work'), silentLog);

  assert.deepEqual(await clipper.runOnce(started + 60_000), [], 'waits for the post-event window');
  assert.deepEqual(await clipper.runOnce(started + 4 * 60_000), ['ev1']);

  assert.equal(store.events[0].clip_url, 'https://media.example/clips/ev1.mp4');
  assert.equal(store.events[0].poster_url, 'https://media.example/posters/ev1.jpg');
  const clip = path.join(dir, 'media/clips/ev1.mp4');
  assert.ok(existsSync(path.join(dir, 'media/posters/ev1.jpg')));
  const d = await durationSec(clip);
  assert.ok(d > 1.5 && d < 2.5, `12 frames at 6 fps ≈ 2 s, got ${d}`);
  assert.deepEqual(await clipper.runOnce(started + 5 * 60_000), [], 'already clipped');
});

test('image camera without frames is given up, not retried forever', async () => {
  const dir = await tempDir('clip-empty');
  const store = new FakeStore();
  store.cameras = [{ id: 'cam', feed_kind: 'image', feed_url: 'x', page_url: null, refresh_sec: 30, schedule: null }];
  store.events = [{ id: 'ev', camera_id: 'cam', started_at: new Date(0).toISOString() }];
  const frames = new FrameBuffer(path.join(dir, 'frames'), 3_600_000);
  const sources = new Map<string, CameraSources>([['cam', { camera: store.cameras[0], frames }]]);
  const clipper = new Clipper(store, new LocalStorage(path.join(dir, 'media'), 'x'), sources, path.join(dir, 'work'), silentLog);
  assert.deepEqual(await clipper.runOnce(3_600_000), []);
  assert.equal(store.events[0].clip_url, undefined);
});

test('live camera: recorded HLS segments become a clip', { timeout: 90_000 }, async () => {
  const dir = await tempDir('clip-hls');

  // A local live HLS stream (stands in for Caltrans / OOI), served over HTTP.
  const live = path.join(dir, 'live');
  await import('node:fs/promises').then((fs) => fs.mkdir(live));
  const encoder = spawn('ffmpeg', [
    '-loglevel', 'error', '-re', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '25', '-f', 'hls', '-hls_time', '1',
    '-hls_list_size', '6', '-hls_flags', 'delete_segments', path.join(live, 'playlist.m3u8'),
  ]);
  const server = createServer((req, res) => {
    const file = path.join(live, path.basename(req.url ?? ''));
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200);
    createReadStream(file).pipe(res);
  }).listen(0);
  const port = (server.address() as AddressInfo).port;

  try {
    while (!existsSync(path.join(live, 'playlist.m3u8'))) await sleep(200);
    const hlsDir = path.join(dir, 'ring');
    const recorder = new HlsRecorder(`http://127.0.0.1:${port}/playlist.m3u8`, hlsDir, silentLog);
    await recorder.start();
    const started = Date.now();
    await sleep(14_000);
    recorder.stop();

    const store = new FakeStore();
    store.cameras = [{ id: 'live', feed_kind: 'hls', feed_url: 'x', page_url: null, refresh_sec: null, schedule: 'continuous' }];
    store.events = [{ id: 'ev-live', camera_id: 'live', started_at: new Date(started + 5_000).toISOString() }];
    const sources = new Map<string, CameraSources>([['live', { camera: store.cameras[0], hlsDir }]]);
    const clipper = new Clipper(store, new LocalStorage(path.join(dir, 'media'), 'https://media.example'), sources, path.join(dir, 'work'), silentLog);

    assert.deepEqual(await clipper.runOnce(started + 5_000 + 16_000), ['ev-live']);
    const d = await durationSec(path.join(dir, 'media/clips/ev-live.mp4'));
    assert.ok(d >= 6, `clip should hold several seconds of video, got ${d}`);
  } finally {
    encoder.kill('SIGKILL');
    server.close();
  }
});
