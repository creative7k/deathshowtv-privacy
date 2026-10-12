-- Strange Cams — alertes officielles et catalogue de milliers de caméras.

-- Les caméras ont une position (pour trouver la plus proche d'une alerte) et une source.
alter table public.cameras
  add column lat double precision,
  add column lon double precision,
  add column source text not null default 'manual',
  -- Caméras « vedettes » : enregistrées en continu par le worker et proposées dans le feed
  -- quand il n'y a pas d'événement. Les autres (des milliers) ne servent que lors d'une alerte.
  add column featured boolean not null default false;

create index cameras_geo_idx on public.cameras (lat, lon) where active and lat is not null;

-- Événements créés à partir d'une alerte officielle (CHP, USGS, NOAA…).
alter type public.event_origin add value if not exists 'alert';

alter table public.events
  add column alert_source text,
  add column alert_ref text,
  -- Une même alerte officielle ne crée qu'un seul événement.
  add constraint events_alert_unique unique (alert_source, alert_ref);
