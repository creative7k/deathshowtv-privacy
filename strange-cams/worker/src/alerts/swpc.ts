import type { Alert } from './types.ts';

export const SWPC_FEED = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

/**
 * Geomagnetic storms (planetary Kp ≥ 6) from NOAA's Space Weather Prediction Center: auroras are likely.
 * Accepts both shapes the product has used: a table with a header row, or a list of objects.
 */
export function parseSwpc(json: unknown, minKp = 6): Alert[] {
  const rows: { time: string; kp: number }[] = [];
  if (Array.isArray(json)) {
    for (const r of json) {
      if (Array.isArray(r) && r[0] !== 'time_tag') rows.push({ time: String(r[0]), kp: Number(r[1]) });
      else if (r && typeof r === 'object' && 'time_tag' in r) rows.push({ time: String(r.time_tag), kp: Number(r.Kp ?? r.kp ?? r.kp_index) });
    }
  }
  const last = rows.at(-1);
  if (!last || !(last.kp >= minKp)) return [];
  const at = Date.parse(last.time.endsWith('Z') ? last.time : `${last.time.replace(' ', 'T')}Z`);
  return [
    {
      source: 'swpc',
      ref: `kp-${last.time}`,
      kind: 'aurora',
      level: last.kp >= 8 ? 3 : last.kp >= 7 ? 2 : 1,
      title: `Tempête magnétique (Kp ${last.kp.toFixed(1)}) : aurores probables`,
      description: 'Alerte météo spatiale de la NOAA (SWPC).',
      at,
    },
  ];
}
