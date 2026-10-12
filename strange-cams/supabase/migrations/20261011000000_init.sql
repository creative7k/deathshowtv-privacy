-- Strange Cams — schéma initial (MVP)
-- Caméras officielles, événements du feed, signalements utilisateurs, votes vrai/faux.

create extension if not exists pgcrypto;

create type public.category_id as enum (
  'faune', 'volcans', 'aurores', 'urbain', 'espace', 'fonds-marins', 'frontieres'
);
create type public.feed_kind as enum ('hls', 'image');
create type public.event_origin as enum ('user', 'ai');
create type public.event_status as enum ('pending', 'published', 'rejected');
create type public.report_type as enum (
  'animal', 'lumiere', 'meteo', 'eruption', 'trafic', 'inexplique', 'autre'
);

-- ---------------------------------------------------------------------------
-- Caméras : uniquement des sources institutionnelles validées (docs/01-audit-sources.md)
-- ---------------------------------------------------------------------------
create table public.cameras (
  id          text primary key,
  category    public.category_id not null,
  name        text not null,
  place       text not null,
  feed_kind   public.feed_kind not null,
  -- HLS playlist, or direct JPEG; null until the ingest worker resolves it from page_url.
  feed_url    text,
  page_url    text,
  refresh_sec integer check (refresh_sec is null or refresh_sec > 0),
  schedule    text check (schedule in ('continuous', 'ooi-every-3h')),
  credit      text not null,
  licence     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (feed_kind = 'image' or feed_url is not null)
);

-- ---------------------------------------------------------------------------
-- Événements : ce que montre le feed
-- ---------------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  camera_id   text not null references public.cameras (id),
  origin      public.event_origin not null,
  status      public.event_status not null default 'published',
  title       text not null check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  paranormal  boolean not null default false,
  clip_url    text,   -- clip time-lapse / segment HLS produit par le worker (étape 4)
  poster_url  text,
  started_at  timestamptz not null default now(),
  votes_up    integer not null default 0,
  votes_down  integer not null default 0,
  alert_level smallint not null default 0 check (alert_level between 0 and 3),
  alert_active boolean not null default false,
  created_at  timestamptz not null default now()
);
create index events_feed_idx on public.events (status, started_at desc);
create index events_camera_idx on public.events (camera_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Signalements et votes
-- ---------------------------------------------------------------------------
create table public.reports (
  id         bigint generated always as identity primary key,
  camera_id  text not null references public.cameras (id),
  user_id    uuid not null,
  type       public.report_type not null,
  note       text check (char_length(note) <= 280),
  event_id   uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now()
);
create index reports_window_idx on public.reports (camera_id, created_at desc);

create table public.votes (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Compteurs dénormalisés : le feed lit events.votes_up/down, le temps réel les diffuse.
create function public.apply_vote_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update events
       set votes_up   = votes_up   - (old.value = 1)::int,
           votes_down = votes_down - (old.value = -1)::int
     where id = old.event_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update events
       set votes_up   = votes_up   + (new.value = 1)::int,
           votes_down = votes_down + (new.value = -1)::int
     where id = new.event_id;
  end if;
  return null;
end $$;

create trigger votes_counts
after insert or update of value or delete on public.votes
for each row execute function public.apply_vote_counts();

-- ---------------------------------------------------------------------------
-- Signalement → événement
-- Un signalement rejoint l'événement ouvert de la caméra (< 10 min) s'il existe ;
-- sinon un événement est créé dès que REPORT_THRESHOLD personnes distinctes
-- ont signalé la même caméra dans la fenêtre de 2 minutes.
-- ---------------------------------------------------------------------------
create function public.submit_report(p_camera_id text, p_type public.report_type, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  REPORT_THRESHOLD constant int := 3;
  v_user   uuid := auth.uid();
  v_event  uuid;
  v_count  int;
  v_top    public.report_type;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from cameras where id = p_camera_id and active) then
    raise exception 'unknown camera %', p_camera_id using errcode = '22023';
  end if;
  -- Anti-spam : un signalement par personne et par caméra toutes les 2 minutes.
  if exists (
    select 1 from reports
     where user_id = v_user and camera_id = p_camera_id
       and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'already reported recently' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select id into v_event
    from events
   where camera_id = p_camera_id and origin = 'user' and status = 'published'
     and started_at > now() - interval '10 minutes'
   order by started_at desc
   limit 1;

  insert into reports (camera_id, user_id, type, note, event_id)
  values (p_camera_id, v_user, p_type, nullif(trim(p_note), ''), v_event);

  if v_event is not null then
    return v_event;
  end if;

  select count(distinct user_id) into v_count
    from reports
   where camera_id = p_camera_id and event_id is null
     and created_at > now() - interval '2 minutes';

  if v_count < REPORT_THRESHOLD then
    return null;
  end if;

  select type into v_top
    from reports
   where camera_id = p_camera_id and event_id is null
     and created_at > now() - interval '2 minutes'
   group by type
   order by count(*) desc, max(created_at) desc
   limit 1;

  insert into events (camera_id, origin, title, description, paranormal)
  values (
    p_camera_id,
    'user',
    case v_top
      when 'animal'     then 'Animal repéré'
      when 'lumiere'    then 'Lumière étrange'
      when 'meteo'      then 'Météo extrême'
      when 'eruption'   then 'Activité volcanique'
      when 'trafic'     then 'Incident sur la route'
      when 'inexplique' then 'Phénomène inexpliqué'
      else 'Moment étrange'
    end,
    format('Signalé par %s spectateurs en moins de 2 minutes.', v_count),
    v_top in ('lumiere', 'inexplique')
  )
  returning id into v_event;

  update reports
     set event_id = v_event
   where camera_id = p_camera_id and event_id is null
     and created_at > now() - interval '2 minutes';

  return v_event;
end $$;

-- Supabase grants EXECUTE on new public functions to anon/authenticated by default: narrow it.
revoke all on function public.submit_report(text, public.report_type, text) from public, anon;
grant execute on function public.submit_report(text, public.report_type, text) to authenticated;
revoke all on function public.apply_vote_counts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cameras enable row level security;
alter table public.events  enable row level security;
alter table public.reports enable row level security;
alter table public.votes   enable row level security;

create policy "cameras are public" on public.cameras
  for select to anon, authenticated using (active);

create policy "published events are public" on public.events
  for select to anon, authenticated using (status = 'published');

-- reports : aucune politique → accès uniquement via submit_report().

create policy "read own votes" on public.votes
  for select to authenticated using (user_id = auth.uid());
create policy "cast own vote" on public.votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
  );
create policy "change own vote" on public.votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own vote" on public.votes
  for delete to authenticated using (user_id = auth.uid());

-- Les colonnes modifiables d'un vote se limitent à sa valeur.
revoke update on public.votes from anon, authenticated;
grant update (value) on public.votes to authenticated;

-- ---------------------------------------------------------------------------
-- Temps réel : les compteurs de votes et les nouveaux événements sont diffusés.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Stockage des clips (offre gratuite : 1 Go) : bucket public en lecture,
-- écrit uniquement par le worker avec la clé service_role.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 52428800, array['video/mp4', 'image/jpeg'])
    on conflict (id) do nothing;
  end if;
end $$;
