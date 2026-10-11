/**
 * Finds the direct JPEG of a camera whose database row only has a web page (feed_url is null).
 * Best effort: picks the first image on the page whose URL looks like a webcam capture.
 * Pages change; when this returns null the camera is skipped and logged.
 */
export function findWebcamImage(html: string, pageUrl: string): string | null {
  const candidates = [...html.matchAll(/<img[^>]+src=["']([^"']+\.jpe?g(?:\?[^"']*)?)["']/gi)].map((m) => m[1]);
  const hit = candidates.find((src) => /webcam|cam\d|\/cams?\//i.test(src));
  return hit ? new URL(hit, pageUrl).toString() : null;
}

export async function resolveImageUrl(pageUrl: string): Promise<string | null> {
  const res = await fetch(pageUrl, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  return findWebcamImage(await res.text(), pageUrl);
}
