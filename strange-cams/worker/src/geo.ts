export type Point = { lat: number; lon: number };

/** Great-circle distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Closest item within `maxKm`, or null. Items without a position are ignored. */
export function nearest<T extends { lat?: number | null; lon?: number | null }>(
  items: T[],
  p: Point,
  maxKm: number,
): { item: T; km: number } | null {
  let best: { item: T; km: number } | null = null;
  for (const item of items) {
    if (item.lat == null || item.lon == null) continue;
    const km = distanceKm(p, { lat: item.lat, lon: item.lon });
    if (km <= maxKm && (!best || km < best.km)) best = { item, km };
  }
  return best;
}

/** Ray-casting point-in-polygon test; `ring` is a GeoJSON ring of [lon, lat] pairs. */
export function insideRing(p: Point, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
