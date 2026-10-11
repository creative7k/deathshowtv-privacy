import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaStorage } from './types.ts';

/** Development / tests: copies files into a folder served at `publicBaseUrl`. */
export class LocalStorage implements MediaStorage {
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(root: string, publicBaseUrl: string) {
    this.root = root;
    this.publicBaseUrl = publicBaseUrl;
  }

  async put(key: string, file: string): Promise<string> {
    const dest = path.join(this.root, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(file, dest);
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}

/** Objects whose creation date is older than `cutoff` (ISO dates as returned by storage listings). */
export function expired(objects: { name: string; created_at: string | null }[], cutoff: number): string[] {
  return objects.filter((o) => o.created_at !== null && Date.parse(o.created_at) < cutoff).map((o) => o.name);
}

/**
 * Free option: Supabase Storage (1 GB on the free plan), public bucket `media`
 * created by the migration. Old clips are pruned to stay within the quota.
 */
export class SupabaseStorage implements MediaStorage {
  private readonly sb: SupabaseClient;
  private readonly bucket: string;

  constructor(sb: SupabaseClient, bucket = 'media') {
    this.sb = sb;
    this.bucket = bucket;
  }

  async put(key: string, file: string, contentType: string): Promise<string> {
    const { error } = await this.sb.storage
      .from(this.bucket)
      .upload(key, await readFile(file), { contentType, upsert: true, cacheControl: '31536000' });
    if (error) throw error;
    return this.sb.storage.from(this.bucket).getPublicUrl(key).data.publicUrl;
  }

  async prune(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const folder of ['clips', 'posters']) {
      const { data, error } = await this.sb.storage
        .from(this.bucket)
        .list(folder, { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
      if (error) throw error;
      const old = expired(data, cutoff).map((name) => `${folder}/${name}`);
      if (old.length === 0) continue;
      const del = await this.sb.storage.from(this.bucket).remove(old);
      if (del.error) throw del.error;
      removed += old.length;
    }
    return removed;
  }
}

/** Optional paid alternative: any S3-compatible bucket (Cloudflare R2 recommended: no egress fees). */
export class S3Storage implements MediaStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(opts: { endpoint: string; region?: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl: string }) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? 'auto',
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
    this.bucket = opts.bucket;
    this.publicBaseUrl = opts.publicBaseUrl;
  }

  async put(key: string, file: string, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: await readFile(file),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}
