import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

export function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('error', reject);
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited with ${code}: ${err.slice(-800)}`));
    });
  });
}

/** Entry for an ffmpeg concat list; forward slashes keep Windows paths valid there. */
const listEntry = (file: string) => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;

const ENCODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];

/** Builds a looping time-lapse MP4 (720p, `fps` images per second) from still frames. */
export async function timelapse(frames: string[], out: string, listFile: string, fps = 6): Promise<void> {
  if (frames.length === 0) throw new Error('no frames');
  const d = (1 / fps).toFixed(4);
  // The concat demuxer ignores the duration of the last entry, so it is listed twice.
  const lines = [...frames, frames[frames.length - 1]].map((f, i, all) =>
    i < all.length - 1 ? `${listEntry(f)}\nduration ${d}` : listEntry(f),
  );
  await writeFile(listFile, lines.join('\n') + '\n');
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', `scale=-2:720:force_original_aspect_ratio=decrease,fps=${fps},format=yuv420p`,
    ...ENCODE, out,
  ]);
}

/** Joins recorded HLS segments into one MP4 without re-encoding. */
export async function joinSegments(segments: string[], out: string, listFile: string): Promise<void> {
  if (segments.length === 0) throw new Error('no segments');
  await writeFile(listFile, segments.map(listEntry).join('\n') + '\n');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-an', '-movflags', '+faststart', out]);
}

/** Extracts the last frame of a video as a JPEG poster. */
export async function poster(video: string, out: string): Promise<void> {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-0.5', '-i', video, '-frames:v', '1', '-q:v', '4', '-update', '1', out]);
}

export async function durationSec(file: string): Promise<number> {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(out.trim());
}
