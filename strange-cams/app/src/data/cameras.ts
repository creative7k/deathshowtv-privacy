import type { Camera } from '../types';

/**
 * Official cameras validated in docs/01-audit-sources.md.
 * Only institutional sources; never YouTube or third-party platforms.
 * In production these URLs are fetched by our ingest worker and served from our own CDN;
 * the app never shows a third-party logo, only a text credit.
 */
export const CAMERAS: Camera[] = [
  {
    id: 'caltrans-d7-196',
    category: 'urbain',
    name: 'I-110 · Avenue 26',
    place: 'Los Angeles, Californie',
    feed: {
      kind: 'hls',
      url: 'https://wzmedia.dot.ca.gov/D7/CCTV-196.stream/playlist.m3u8',
      schedule: 'continuous',
    },
    credit: 'Caltrans',
    licence: 'Domaine public',
  },
  {
    id: 'caltrans-d7-2',
    category: 'urbain',
    name: 'I-5 · Slauson Ave',
    place: 'Los Angeles, Californie',
    feed: {
      kind: 'hls',
      url: 'https://wzmedia.dot.ca.gov/D7/CCTV-2.stream/playlist.m3u8',
      schedule: 'continuous',
    },
    credit: 'Caltrans',
    licence: 'Domaine public',
  },
  {
    id: 'ooi-camhd',
    category: 'fonds-marins',
    name: 'Cheminée hydrothermale « Mushroom »',
    place: 'Axial Seamount · 1 500 m de fond',
    feed: {
      kind: 'hls',
      url: 'https://stream.ocean.washington.edu/camhdLive/camhdWSE/playlist.m3u8',
      schedule: 'ooi-every-3h',
    },
    credit: 'OOI · NSF · University of Washington',
    licence: 'Données ouvertes',
  },
  {
    id: 'usgs-v1cam',
    category: 'volcans',
    name: 'Kīlauea · V1cam',
    place: 'Cratère Halemaʻumaʻu, Hawaï',
    feed: {
      kind: 'image',
      url: 'https://volcanoes.usgs.gov/observatories/hvo/cams/V1cam/images/M.jpg',
      pageUrl: 'https://www.usgs.gov/media/webcams/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater',
      refreshSec: 60,
    },
    credit: 'USGS',
    licence: 'Domaine public',
  },
  {
    id: 'goes19-fulldisk',
    category: 'espace',
    name: 'GOES-19 · Terre entière',
    place: 'Orbite géostationnaire, 35 786 km',
    feed: {
      kind: 'image',
      url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg',
      pageUrl: 'https://www.star.nesdis.noaa.gov/goes/fulldisk.php?sat=G19',
      refreshSec: 600,
    },
    credit: 'NOAA / NESDIS',
    licence: 'Domaine public',
  },
  {
    id: 'usap-mcmurdo',
    category: 'frontieres',
    name: 'McMurdo Station',
    place: 'Île de Ross, Antarctique',
    feed: {
      kind: 'image',
      url: 'https://www.usap.gov/videoclipsandmaps/SouthPoleWebcam/McM00008.jpg',
      pageUrl: 'https://www.usap.gov/videoclipsandmaps/mcmwebcam.cfm',
      refreshSec: 30,
    },
    credit: 'USAP / NSF',
    licence: 'Domaine public',
  },
  {
    // Interim aurora source: no dedicated all-sky camera is cleared yet (UAF and AAD need written approval).
    id: 'usap-southpole',
    category: 'aurores',
    name: 'Pôle Sud · Amundsen-Scott',
    place: 'Pôle Sud géographique',
    feed: {
      kind: 'image',
      url: null,
      pageUrl: 'https://www.usap.gov/videoclipsandmaps/spwebcam.cfm',
      refreshSec: 60,
    },
    credit: 'USAP / NSF',
    licence: 'Domaine public',
  },
  {
    // Image URL is resolved by the ingest worker through the NPS API (/webcams).
    id: 'nps-yell-washburn',
    category: 'faune',
    name: 'Mount Washburn · vue nord-est',
    place: 'Yellowstone, Wyoming',
    feed: {
      kind: 'image',
      url: null,
      pageUrl: 'https://www.nps.gov/media/webcam/view.htm?id=81B46891-1DD8-B71B-0B6575944D4DECD5',
      refreshSec: 60,
    },
    credit: 'National Park Service',
    licence: 'Domaine public',
  },
];

export const cameraById = (id: string): Camera => {
  const camera = CAMERAS.find((c) => c.id === id);
  if (!camera) throw new Error(`Unknown camera ${id}`);
  return camera;
};
