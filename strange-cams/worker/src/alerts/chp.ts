import type { Alert } from './types.ts';

export const CHP_FEED = 'https://media.chp.ca.gov/sa_xml/sa.xml';

const unquote = (s: string) => s.trim().replace(/^"|"$/g, '').trim();
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? unquote(m[1]) : '';
};

/** "Oct 11 2026  5:01PM" in California time → epoch ms. */
export function parsePacificTime(s: string, now = Date.now()): number {
  const m = s.match(/^(\w{3}) (\d{1,2}) (\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!m) return now;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hour = Number(m[4]) % 12;
  if (m[6] === 'PM') hour += 12;
  const asUtc = Date.UTC(Number(m[3]), months.indexOf(m[1]), Number(m[2]), hour, Number(m[5]));
  // Offset of America/Los_Angeles at that moment (handles daylight saving time).
  const local = new Date(asUtc).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23' });
  const offset = Date.parse(`${local} UTC`) - asUtc;
  return asUtc - offset;
}

/** Which CHP incident types become events, and how. Anything else is ignored. */
function classify(type: string): { kind: Alert['kind']; level: 1 | 2 | 3; label: string } | null {
  const t = type.toLowerCase();
  if (t.includes('collision') && (t.includes('1141') || t.includes('injur') || t.startsWith('1179'))) return { kind: 'accident', level: 3, label: 'Accident avec blessés' };
  if (t.includes('collision') && t.includes('unkn')) return { kind: 'accident', level: 2, label: 'Accident' };
  if (t.includes('collision') || t.includes('hit and run')) return { kind: 'accident', level: 1, label: 'Accrochage' };
  if (t.startsWith('fire') || t.includes('car fire') || t.includes('vehicle fire')) return { kind: 'fire', level: 2, label: 'Incendie' };
  if (t.includes('sig alert')) return { kind: 'hazard', level: 2, label: 'Alerte trafic majeure' };
  if (t.startsWith('flood')) return { kind: 'flood', level: 2, label: 'Route inondée' };
  if (t.includes('traffic hazard') || t.includes('animal')) return { kind: 'hazard', level: 1, label: 'Danger sur la route' };
  return null;
}

/**
 * Parses CHP's live incident feed (all California dispatch centres).
 * Only the incident type and place are kept: the free-text details can describe people and vehicles.
 */
export function parseChp(xml: string, now = Date.now()): Alert[] {
  const out: Alert[] = [];
  for (const m of xml.matchAll(/<Log ID\s*=\s*"([^"]+)">([\s\S]*?)<\/Log>/g)) {
    const [, id, body] = m;
    const cls = classify(tag(body, 'LogType'));
    const [latRaw, lonRaw] = tag(body, 'LATLON').split(':');
    if (!cls || !latRaw || !lonRaw) continue;
    const lat = Number(latRaw) / 1e6;
    const lon = -Number(lonRaw) / 1e6; // the feed gives the western longitude without its sign
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0) continue;
    const location = tag(body, 'Location');
    const area = tag(body, 'Area');
    out.push({
      source: 'chp',
      ref: id,
      kind: cls.kind,
      level: cls.level,
      title: `${cls.label} · ${location || area}`,
      description: `Signalé par la police routière de Californie (CHP)${area ? ` · secteur ${area}` : ''}.`,
      at: parsePacificTime(tag(body, 'LogTime'), now),
      lat,
      lon,
    });
  }
  return out;
}
