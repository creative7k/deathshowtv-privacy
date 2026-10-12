-- Caméras vedettes validées (voir docs/01-audit-sources.md). Réexécutable.
-- Nécessite les deux migrations (positions GPS et colonne « featured »).
insert into public.cameras (id, category, name, place, feed_kind, feed_url, page_url, refresh_sec, schedule, credit, licence, lat, lon, featured) values
  ('caltrans-d7-196', 'urbain', 'I-110 · Avenue 26', 'Los Angeles, Californie', 'hls',
   'https://wzmedia.dot.ca.gov/D7/CCTV-196.stream/playlist.m3u8', null, null, 'continuous', 'Caltrans', 'Domaine public', 34.0837, -118.2215, true),
  ('caltrans-d7-2', 'urbain', 'I-5 · Slauson Ave', 'Los Angeles, Californie', 'hls',
   'https://wzmedia.dot.ca.gov/D7/CCTV-2.stream/playlist.m3u8', null, null, 'continuous', 'Caltrans', 'Domaine public', 33.97857, -118.12791, true),
  ('ooi-camhd', 'fonds-marins', 'Cheminée hydrothermale « Mushroom »', 'Axial Seamount · 1 500 m de fond', 'hls',
   'https://stream.ocean.washington.edu/camhdLive/camhdWSE/playlist.m3u8', 'https://oceanobservatories.org/streaming-underwater-video/',
   null, 'ooi-every-3h', 'OOI · NSF · University of Washington', 'Données ouvertes', 45.9334, -130.0137, true),
  ('usgs-v1cam', 'volcans', 'Kīlauea · V1cam', 'Cratère Halemaʻumaʻu, Hawaï', 'image',
   'https://volcanoes.usgs.gov/observatories/hvo/cams/V1cam/images/M.jpg',
   'https://www.usgs.gov/media/webcams/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater', 60, null, 'USGS', 'Domaine public', 19.4069, -155.2834, true),
  ('goes19-fulldisk', 'espace', 'GOES-19 · Terre entière', 'Orbite géostationnaire, 35 786 km', 'image',
   'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg',
   'https://www.star.nesdis.noaa.gov/goes/fulldisk.php?sat=G19', 600, null, 'NOAA / NESDIS', 'Domaine public', null, null, true),
  ('usap-mcmurdo', 'frontieres', 'McMurdo Station', 'Île de Ross, Antarctique', 'image',
   'https://www.usap.gov/videoclipsandmaps/SouthPoleWebcam/McM00008.jpg',
   'https://www.usap.gov/videoclipsandmaps/mcmwebcam.cfm', 30, null, 'USAP / NSF', 'Domaine public', -77.8463, 166.6682, true),
  ('usap-southpole', 'aurores', 'Pôle Sud · Amundsen-Scott', 'Pôle Sud géographique', 'image',
   null, 'https://www.usap.gov/videoclipsandmaps/spwebcam.cfm', 60, null, 'USAP / NSF', 'Domaine public', -90.0, 0.0, true),
  ('nps-yell-washburn', 'faune', 'Mount Washburn · vue nord-est', 'Yellowstone, Wyoming', 'image',
   null, 'https://www.nps.gov/media/webcam/view.htm?id=81B46891-1DD8-B71B-0B6575944D4DECD5', 60, null,
   'National Park Service', 'Domaine public', 44.7974, -110.4342, true)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, place = excluded.place,
  feed_kind = excluded.feed_kind, feed_url = excluded.feed_url, page_url = excluded.page_url,
  refresh_sec = excluded.refresh_sec, schedule = excluded.schedule,
  credit = excluded.credit, licence = excluded.licence,
  lat = excluded.lat, lon = excluded.lon, featured = excluded.featured;
