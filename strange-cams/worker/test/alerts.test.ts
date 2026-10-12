import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseChp, parsePacificTime } from '../src/alerts/chp.ts';
import { parseUsgs } from '../src/alerts/usgs.ts';
import { parseNws } from '../src/alerts/nws.ts';
import { parseSwpc } from '../src/alerts/swpc.ts';
import { AlertDispatcher, pickCamera } from '../src/alerts/dispatcher.ts';
import { parseCaltrans } from '../src/catalog/caltrans.ts';
import { distanceKm } from '../src/geo.ts';
import type { Alert } from '../src/alerts/types.ts';
import type { Camera } from '../src/types.ts';
import { FakeStore, silentLog } from './helpers.ts';

const chpXml = () => readFile(new URL('./fixtures/chp-sample.xml', import.meta.url), 'utf8');

test('California time is converted with daylight saving time', () => {
  assert.equal(new Date(parsePacificTime('Oct 12 2026  9:15AM')).toISOString(), '2026-10-12T16:15:00.000Z'); // PDT
  assert.equal(new Date(parsePacificTime('Jan 5 2026  12:30AM')).toISOString(), '2026-01-05T08:30:00.000Z'); // PST
});

test('CHP incidents: collisions and fires kept, positions decoded, details dropped', async () => {
  const alerts = parseChp(await chpXml());
  assert.deepEqual(alerts.map((a) => [a.ref, a.kind, a.level]), [
    ['261012LA0001', 'accident', 3],
    ['261012LA0002', 'accident', 1],
  ]); // maintenance is ignored, the fire has no position
  const first = alerts[0];
  assert.equal(first.lat, 34.0839);
  assert.equal(first.lon, -118.2218);
  assert.equal(first.title, 'Accident avec blessés · I110 N / Avenue 26 Ofr');
  assert.ok(!JSON.stringify(alerts).includes('SEDAN'), 'free-text details must not leak');
});

test('USGS earthquakes below magnitude 4 are ignored', () => {
  const alerts = parseUsgs({
    features: [
      { id: 'hv1', properties: { mag: 5.3, place: '10 km SW of Volcano, Hawaii', time: 1 }, geometry: { coordinates: [-155.3, 19.4, 5] } },
      { id: 'ci2', properties: { mag: 2.7, place: 'small', time: 2 }, geometry: { coordinates: [-118, 34, 5] } },
    ],
  });
  assert.deepEqual(alerts.map((a) => [a.ref, a.level, a.lat, a.lon]), [['hv1', 2, 19.4, -155.3]]);
});

test('NWS: severe warnings with a shape are kept and translated', () => {
  const square = [[[-119, 33], [-117, 33], [-117, 35], [-119, 35], [-119, 33]]];
  const alerts = parseNws({
    features: [
      { properties: { id: 'n1', event: 'Tornado Warning', severity: 'Extreme', headline: null, areaDesc: 'Los Angeles', onset: '2026-10-12T16:00:00Z', sent: '' }, geometry: { type: 'Polygon', coordinates: square } },
      { properties: { id: 'n2', event: 'Heat Advisory', severity: 'Severe', headline: null, areaDesc: 'x', onset: null, sent: '2026-10-12T16:00:00Z' }, geometry: { type: 'Polygon', coordinates: square } },
      { properties: { id: 'n3', event: 'Flash Flood Warning', severity: 'Severe', headline: null, areaDesc: 'x', onset: null, sent: '2026-10-12T16:00:00Z' }, geometry: null },
    ],
  });
  assert.deepEqual(alerts.map((a) => [a.ref, a.title, a.level]), [['n1', 'Tornade en cours', 3]]);
});

test('SWPC: Kp ≥ 6 raises an aurora alert, both feed shapes accepted', () => {
  const table = [['time_tag', 'Kp', 'a_running', 'station_count'], ['2026-10-12 12:00:00.000', '7.33', '154', '8']];
  assert.deepEqual(parseSwpc(table).map((a) => [a.kind, a.level]), [['aurora', 2]]);
  assert.deepEqual(parseSwpc([{ time_tag: '2026-10-12T12:00:00', Kp: 4 }]), []);
  assert.equal(parseSwpc([{ time_tag: '2026-10-12T12:00:00', Kp: 8.67 }])[0].level, 3);
});

test('Caltrans catalogue: video when available, still image otherwise, out-of-service kept inactive', () => {
  const rec = (index: string, hls: string, img: string, inService = 'true') => ({
    cctv: {
      index, inService,
      location: { district: '7', locationName: `Cam ${index}`, nearbyPlace: 'Los Angeles', latitude: '34.08', longitude: '-118.22' },
      imageData: { streamingVideoURL: hls, static: { currentImageURL: img, currentImageUpdateFrequency: '2' } },
    },
  });
  const rows = parseCaltrans({ data: [rec('1', 'https://v/1.m3u8', 'https://i/1.jpg'), rec('2', '', 'https://i/2.jpg', 'false'), rec('3', '', '')] });
  assert.deepEqual(rows.map((r) => [r.id, r.feed_kind, r.feed_url, r.refresh_sec, r.active]), [
    ['ct-d7-1', 'hls', 'https://v/1.m3u8', null, true],
    ['ct-d7-2', 'image', 'https://i/2.jpg', 120, false],
  ]);
});

const cams: Camera[] = [
  { id: 'near', category: 'urbain', feed_kind: 'hls', feed_url: 'u', page_url: null, refresh_sec: null, schedule: 'continuous', lat: 34.0837, lon: -118.2215 },
  { id: 'far', category: 'urbain', feed_kind: 'image', feed_url: 'u', page_url: null, refresh_sec: 120, schedule: null, lat: 37.77, lon: -122.42 },
  { id: 'pole', category: 'aurores', feed_kind: 'image', feed_url: 'u', page_url: null, refresh_sec: 60, schedule: null, lat: -90, lon: 0 },
];
const accident = (ref: string, at: number, lat = 34.0839, lon = -118.2218): Alert => ({
  source: 'chp', ref, kind: 'accident', level: 3, title: 'Accident', description: '', at, lat, lon,
});

test('the closest camera within range films the alert', () => {
  assert.ok(distanceKm({ lat: 34.0839, lon: -118.2218 }, { lat: 34.0837, lon: -118.2215 }) < 0.1);
  assert.equal(pickCamera(accident('a', 0), cams)?.id, 'near');
  assert.equal(pickCamera(accident('b', 0, 34.9, -117.0), cams), null, 'no camera within 1.5 km');
  assert.equal(pickCamera({ source: 'swpc', ref: 'k', kind: 'aurora', level: 2, title: '', description: '', at: 0 }, cams)?.id, 'pole');
});

test('dispatcher publishes once, records at once, skips stale alerts', async () => {
  const store = new FakeStore();
  const recorded: string[] = [];
  const d = new AlertDispatcher(store, (c) => recorded.push(c.id), silentLog);
  const now = Date.now();

  const first = await d.handle([accident('x1', now - 60_000), accident('old', now - 3_600_000)], cams, now);
  assert.equal(first.length, 1);
  assert.deepEqual(recorded, ['near']);
  assert.equal(store.events[0].alert?.alert_level, 3);

  assert.deepEqual(await d.handle([accident('x1', now - 60_000)], cams, now), [], 'same alert seen again');
  const restarted = new AlertDispatcher(store, () => {}, silentLog);
  assert.deepEqual(await restarted.handle([accident('x1', now - 60_000)], cams, now), [], 'database dedupe after a restart');
});
