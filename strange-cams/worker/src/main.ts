import path from 'node:path';
import { AlertDispatcher, ALERT_RECORDING_MS } from './alerts/dispatcher.ts';
import { CHP_FEED, parseChp } from './alerts/chp.ts';
import { NWS_FEED, parseNws } from './alerts/nws.ts';
import { SWPC_FEED, parseSwpc } from './alerts/swpc.ts';
import { USGS_FEED, parseUsgs } from './alerts/usgs.ts';
import type { Alert } from './alerts/types.ts';
import { fetchCaltransCatalog } from './catalog/caltrans.ts';
import { Clipper } from './clipper.ts';
import { RecordingPool } from './recording.ts';
import { resolveImageUrl } from './resolve.ts';
import { LocalStorage, S3Storage, SupabaseStorage } from './storage.ts';
import { SupabaseStore } from './store.ts';
import type { Camera, Logger, MediaStorage } from './types.ts';

const log: Logger = (msg, extra) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

/** Error text including its cause (fetch hides the real network/TLS reason in `cause`). */
const describe = (e: unknown): string => {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause as { code?: string; message?: string } | undefined;
  return cause ? `${e.message} (${cause.code ?? ''} ${cause.message ?? ''})`.replace(/\s+\)/, ')') : e.message;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const USER_AGENT = `StrangeCams-Ingest/0.2 (${process.env.INGEST_CONTACT || 'no contact set'})`;
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
const fetchJson = async (url: string): Promise<unknown> => JSON.parse(await fetchText(url));

/** Runs `task` now and then every `ms`, logging failures instead of crashing. */
function every(name: string, ms: number, task: () => Promise<void>): void {
  const run = async () => {
    try {
      await task();
    } catch (e) {
      log(`${name} failed`, { error: describe(e) });
    }
    setTimeout(run, ms);
  };
  void run();
}

const dataDir = process.env.DATA_DIR ?? path.resolve('data');
const store = new SupabaseStore(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));

function makeStorage(): MediaStorage {
  if (process.env.S3_BUCKET) {
    return new S3Storage({
      endpoint: required('S3_ENDPOINT'),
      bucket: required('S3_BUCKET'),
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      publicBaseUrl: required('MEDIA_PUBLIC_BASE_URL'),
    });
  }
  if (process.env.MEDIA_LOCAL_DIR) {
    log('clips are written to MEDIA_LOCAL_DIR (dev only)');
    return new LocalStorage(process.env.MEDIA_LOCAL_DIR, process.env.MEDIA_PUBLIC_BASE_URL ?? 'http://localhost:8090');
  }
  // Default, free: the project's own Supabase Storage.
  return new SupabaseStorage(store.sb);
}

// 1. Catalogue: thousands of official cameras (Caltrans for now), refreshed daily.
async function syncCatalog(): Promise<void> {
  const rows = await fetchCaltransCatalog(fetchJson);
  if (rows.length > 0) await store.upsertCameras(rows);
  log('caltrans catalogue synced', { cameras: rows.length });
}
if (process.env.SYNC_CALTRANS !== 'false') {
  await syncCatalog().catch((e) => log('caltrans sync failed', { error: describe(e) }));
  setInterval(() => void syncCatalog().catch((e) => log('caltrans sync failed', { error: describe(e) })), 24 * 3_600_000);
}

// 2. Featured cameras are captured all the time; the others only when an alert lands on them.
const pool = new RecordingPool(dataDir, log);
let cameras: Camera[] = [];
async function loadCameras(): Promise<void> {
  cameras = await store.listCameras();
  for (const camera of cameras.filter((c) => c.featured)) {
    if (!camera.feed_url && camera.page_url) {
      camera.feed_url = await resolveImageUrl(camera.page_url).catch(() => null);
      log(camera.feed_url ? 'resolved image url' : 'could not resolve image url', { camera: camera.id });
    }
    pool.ensure(camera, Infinity);
  }
  log('cameras loaded', { total: cameras.length, featured: cameras.filter((c) => c.featured).length });
}
every('camera refresh', 3_600_000, loadCameras);

// 3. Official alerts → event published at once (shown live) → recording → replay clip.
const dispatcher = new AlertDispatcher(store, (camera) => pool.ensure(camera, ALERT_RECORDING_MS), log);
const watch = (name: string, ms: number, read: () => Promise<Alert[]>) =>
  every(name, ms, async () => {
    if (cameras.length === 0) return;
    await dispatcher.handle(await read(), cameras);
  });
watch('chp incidents', 60_000, async () => parseChp(await fetchText(CHP_FEED)));
watch('usgs earthquakes', 60_000, async () => parseUsgs((await fetchJson(USGS_FEED)) as never));
watch('nws weather', 120_000, async () => parseNws((await fetchJson(NWS_FEED)) as never));
watch('swpc aurora', 600_000, async () => parseSwpc(await fetchJson(SWPC_FEED)));
every('alert expiry', 60_000, () => store.expireAlerts(30 * 60_000));

// 4. Clips for every event, and old clips removed to stay within the free storage.
const storage = makeStorage();
const clipper = new Clipper(store, storage, pool.sources, path.join(dataDir, 'work'), log);
every('clipper', 10_000, async () => {
  await clipper.runOnce();
});
const retentionMs = Number(process.env.CLIP_RETENTION_DAYS ?? 3) * 24 * 3_600_000;
every('prune', 3_600_000, async () => {
  const n = (await storage.prune?.(retentionMs)) ?? 0;
  if (n > 0) log('pruned old clips', { files: n });
});

log('ingest started');
