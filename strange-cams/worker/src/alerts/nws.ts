import type { Alert } from './types.ts';

export const NWS_FEED = 'https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe';

type Feature = {
  properties: { id: string; event: string; severity: string; headline: string | null; areaDesc: string; onset: string | null; sent: string };
  geometry: { type: string; coordinates: number[][][] } | null;
};

const FRENCH: [RegExp, string][] = [
  [/tornado/i, 'Tornade'],
  [/hurricane/i, 'Ouragan'],
  [/flash flood/i, 'Crue soudaine'],
  [/thunderstorm/i, 'Orage violent'],
  [/blizzard|winter storm/i, 'Tempête de neige'],
  [/dust/i, 'Tempête de sable'],
  [/fire/i, 'Risque d’incendie extrême'],
  [/wind/i, 'Vents violents'],
  [/flood/i, 'Inondation'],
];

/** Severe and extreme weather warnings from the US National Weather Service (public domain). */
export function parseNws(json: { features: Feature[] }): Alert[] {
  const out: Alert[] = [];
  for (const f of json.features ?? []) {
    if (f.geometry?.type !== 'Polygon') continue; // zone-only alerts have no shape to match cameras
    const label = FRENCH.find(([re]) => re.test(f.properties.event))?.[1];
    if (!label) continue;
    out.push({
      source: 'nws',
      ref: f.properties.id,
      kind: 'weather',
      level: f.properties.severity === 'Extreme' ? 3 : 2,
      title: `${label} en cours`,
      description: `${f.properties.areaDesc} · alerte du service météo américain (NWS).`,
      at: Date.parse(f.properties.onset ?? f.properties.sent),
      area: f.geometry.coordinates,
    });
  }
  return out;
}
