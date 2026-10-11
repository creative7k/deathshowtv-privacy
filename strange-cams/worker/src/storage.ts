import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

/** Production: any S3-compatible bucket (Cloudflare R2 recommended: no egress fees). */
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
