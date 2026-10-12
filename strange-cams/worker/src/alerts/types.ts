export type AlertKind = 'accident' | 'fire' | 'hazard' | 'flood' | 'quake' | 'weather' | 'aurora';

/** An official alert, before it is matched to a camera. */
export type Alert = {
  source: 'chp' | 'usgs' | 'nws' | 'swpc';
  /** Identifier given by the source; with `source`, makes the alert unique. */
  ref: string;
  kind: AlertKind;
  title: string;
  description: string;
  /** 1 (minor) … 3 (major). */
  level: 1 | 2 | 3;
  at: number;
  lat?: number;
  lon?: number;
  /** GeoJSON polygon rings ([lon, lat]) when the alert covers an area. */
  area?: number[][][];
};
