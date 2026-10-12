import type { CameraUpsert } from '../types.ts';

const DISTRICTS = Array.from({ length: 12 }, (_, i) => i + 1);
export const districtUrl = (d: number) =>
  `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2, '0')}.json`;

type Record = {
  cctv: {
    index: string;
    inService: string;
    location: { district: string; locationName: string; nearbyPlace: string; latitude: string; longitude: string };
    imageData: {
      streamingVideoURL: string;
      static: { currentImageURL: string; currentImageUpdateFrequency: string };
    };
  };
};

/** Converts one district file of Caltrans' official CCTV catalogue (CWWP2) into camera rows. */
export function parseCaltrans(json: { data: Record[] } | Record[]): CameraUpsert[] {
  const out: CameraUpsert[] = [];
  const records = Array.isArray(json) ? json : (json.data ?? []);
  for (const { cctv } of records) {
    const loc = cctv.location;
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);
    const hls = cctv.imageData.streamingVideoURL?.trim();
    const img = cctv.imageData.static.currentImageURL?.trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!hls && !img)) continue;
    out.push({
      id: `caltrans-d${Number(loc.district)}-${cctv.index}`,
      category: 'urbain',
      name: loc.locationName,
      place: loc.nearbyPlace ? `${loc.nearbyPlace}, Californie` : 'Californie',
      feed_kind: hls ? 'hls' : 'image',
      feed_url: hls || img,
      page_url: null,
      refresh_sec: hls ? null : Math.max(60, Number(cctv.imageData.static.currentImageUpdateFrequency) * 60 || 120),
      schedule: hls ? 'continuous' : null,
      credit: 'Caltrans',
      licence: 'Domaine public',
      lat,
      lon,
      source: 'caltrans',
      active: cctv.inService === 'true',
    });
  }
  return out;
}

export async function fetchCaltransCatalog(fetchJson: (url: string) => Promise<unknown>): Promise<CameraUpsert[]> {
  const all: CameraUpsert[] = [];
  for (const d of DISTRICTS) {
    try {
      all.push(...parseCaltrans((await fetchJson(districtUrl(d))) as { data: Record[] }));
    } catch {
      // A district file can be temporarily unavailable; the others still load.
    }
  }
  return all;
}
