import path from 'node:path';
import { Clipper, type CameraSources } from './clipper.ts';
import { FrameBuffer, imageWindow } from './frames.ts';
import { HlsRecorder } from './hls.ts';
import { ImagePoller } from './poller.ts';
import { resolveImageUrl } from './resolve.ts';
import { LocalStorage, S3Storage, SupabaseStorage } from './storage.ts';
import { SupabaseStore } from './store.ts';
import type { Logger, MediaStorage } from './types.ts';

const log: Logger = (msg, extra) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

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

const dataDir = process.env.DATA_DIR ?? path.resolve('data');
const store = new SupabaseStore(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
const sources = new Map<string, CameraSources>();

for (const camera of await store.listCameras()) {
  const src: CameraSources = { camera };
  sources.set(camera.id, src);

  if (camera.feed_kind === 'hls' && camera.feed_url) {
    src.hlsDir = path.join(dataDir, 'hls', camera.id);
    await new HlsRecorder(camera.feed_url, src.hlsDir, log).start();
    continue;
  }

  let url = camera.feed_url;
  if (!url && camera.page_url) {
    url = await resolveImageUrl(camera.page_url).catch(() => null);
    log(url ? 'resolved image url' : 'could not resolve image url', { camera: camera.id, url });
  }
  if (!url) continue;
  const refresh = camera.refresh_sec ?? 60;
  src.frames = new FrameBuffer(path.join(dataDir, 'frames', camera.id), imageWindow(refresh).retentionMs);
  new ImagePoller(camera.id, url, refresh, src.frames, log).start();
}

log('ingest started', { cameras: sources.size });

const storage = makeStorage();
const clipper = new Clipper(store, storage, sources, path.join(dataDir, 'work'), log);

// Keep stored clips within the free quota: the feed only shows the last 48 h anyway.
const retentionMs = Number(process.env.CLIP_RETENTION_DAYS ?? 3) * 24 * 3_600_000;
const prune = async () => {
  try {
    const n = (await storage.prune?.(retentionMs)) ?? 0;
    if (n > 0) log('pruned old clips', { files: n });
  } catch (e) {
    log('prune failed', { error: String(e) });
  }
};
void prune();
setInterval(prune, 3_600_000);
const loop = async () => {
  try {
    await clipper.runOnce();
  } catch (e) {
    log('clipper pass failed', { error: String(e) });
  }
  setTimeout(loop, 10_000);
};
void loop();
