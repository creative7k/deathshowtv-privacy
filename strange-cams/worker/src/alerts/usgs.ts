import type { Alert } from './types.ts';

export const USGS_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson';

type Feature = { id: string; properties: { mag: number; place: string; time: number }; geometry: { coordinates: number[] } };

/** Earthquakes of magnitude ≥ 4 from USGS' real-time feed (public domain). */
export function parseUsgs(json: { features: Feature[] }, minMag = 4): Alert[] {
  return (json.features ?? [])
    .filter((f) => f.properties.mag >= minMag)
    .map((f) => ({
      source: 'usgs' as const,
      ref: f.id,
      kind: 'quake' as const,
      level: (f.properties.mag >= 6 ? 3 : f.properties.mag >= 5 ? 2 : 1) as 1 | 2 | 3,
      title: `Séisme de magnitude ${f.properties.mag.toFixed(1)}`,
      description: `${f.properties.place} · source USGS.`,
      at: f.properties.time,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
}
