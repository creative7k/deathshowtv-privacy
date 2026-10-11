-- Behavioural tests for the MVP schema. Run with supabase/tests/run-local.sh.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
$$;

-- Users
\set u1 '''00000000-0000-0000-0000-000000000001'''
\set u2 '''00000000-0000-0000-0000-000000000002'''
\set u3 '''00000000-0000-0000-0000-000000000003'''
\set u4 '''00000000-0000-0000-0000-000000000004'''

-- 1. Anonymous visitors see active cameras but cannot report.
set role anon;
select pg_temp.as_user(null);
do $$ begin
  assert (select count(*) from public.cameras) = 8, 'anon should see 8 cameras';
end $$;
reset role;

do $$ begin
  set local role anon;
  perform public.submit_report('usgs-v1cam', 'eruption');
  raise exception 'anon must not be able to report';
exception when insufficient_privilege then null;
end $$;

-- 2. Two reports do not create an event; the third distinct user does.
set role authenticated;
select pg_temp.as_user(:u1::uuid);
do $$ begin assert public.submit_report('usgs-v1cam', 'eruption') is null, 'report 1 should not create an event'; end $$;
select pg_temp.as_user(:u2::uuid);
do $$ begin assert public.submit_report('usgs-v1cam', 'lumiere') is null, 'report 2 should not create an event'; end $$;

-- 3. The same user reporting again within 2 minutes is rate-limited.
do $$ begin
  perform public.submit_report('usgs-v1cam', 'eruption');
  raise exception 'expected rate limit';
exception when raise_exception then
  assert sqlerrm = 'already reported recently', 'unexpected error: ' || sqlerrm;
end $$;

select pg_temp.as_user(:u3::uuid);
do $$
declare ev uuid;
begin
  ev := public.submit_report('usgs-v1cam', 'eruption', '  fontaine de lave  ');
  assert ev is not null, 'third distinct reporter should create an event';
  assert (select title from public.events where id = ev) = 'Activité volcanique', 'title follows the dominant report type';
  assert (select description from public.events where id = ev) like 'Signalé par 3 spectateurs%', 'description counts reporters';
  assert not (select paranormal from public.events where id = ev), 'eruption is not paranormal';
  perform set_config('test.event', ev::text, false);
end $$;

-- 4. A later report on the same camera joins the open event instead of creating a new one.
select pg_temp.as_user(:u4::uuid);
do $$ begin
  assert public.submit_report('usgs-v1cam', 'inexplique') = current_setting('test.event')::uuid,
    'report should join the open event';
  assert (select count(*) from public.events where camera_id = 'usgs-v1cam') = 1, 'only one event for the burst';
end $$;

-- 5. Reports are not readable by clients.
do $$ begin assert (select count(*) from public.reports) = 0, 'reports must be hidden by RLS'; end $$;

-- 6. Votes: counters follow inserts, flips and deletes; one vote per user.
select pg_temp.as_user(:u1::uuid);
insert into public.votes (event_id, value) values (current_setting('test.event')::uuid, 1);
select pg_temp.as_user(:u2::uuid);
insert into public.votes (event_id, value) values (current_setting('test.event')::uuid, -1);
do $$ begin
  assert (select (votes_up, votes_down) = (1, 1) from public.events where id = current_setting('test.event')::uuid),
    'counts after two votes';
end $$;
update public.votes set value = 1 where event_id = current_setting('test.event')::uuid;
do $$ begin
  assert (select (votes_up, votes_down) = (2, 0) from public.events where id = current_setting('test.event')::uuid),
    'counts after flipping a vote';
end $$;
delete from public.votes where event_id = current_setting('test.event')::uuid;
do $$ begin
  assert (select (votes_up, votes_down) = (1, 0) from public.events where id = current_setting('test.event')::uuid),
    'counts after removing a vote';
  assert (select count(*) from public.votes) = 0, 'a user only sees their own votes';
end $$;

do $$ begin
  insert into public.votes (event_id, value) values (current_setting('test.event')::uuid, 1);
  insert into public.votes (event_id, value) values (current_setting('test.event')::uuid, 1);
  raise exception 'duplicate vote should fail';
exception when unique_violation then null;
end $$;

-- 7. Users cannot vote on behalf of someone else, nor write events directly.
do $$ begin
  insert into public.votes (event_id, user_id, value)
  values (current_setting('test.event')::uuid, '00000000-0000-0000-0000-000000000009', 1);
  raise exception 'impersonated vote should fail';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.events (camera_id, origin, title) values ('usgs-v1cam', 'user', 'fake');
  raise exception 'direct event insert should fail';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  update public.events set votes_up = 9999;
  assert (select max(votes_up) from public.events) < 9999, 'clients must not edit counters';
end $$;

-- 8. Unpublished events are hidden.
reset role;
update public.events set status = 'rejected' where id = current_setting('test.event')::uuid;
set role authenticated;
do $$ begin assert (select count(*) from public.events) = 0, 'rejected events are hidden'; end $$;

-- 9. Paranormal flag for strange reports.
reset role;
update public.events set status = 'published';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select public.submit_report('ooi-camhd', 'inexplique');
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select public.submit_report('ooi-camhd', 'lumiere');
select pg_temp.as_user('00000000-0000-0000-0000-000000000013');
do $$
declare ev uuid;
begin
  ev := public.submit_report('ooi-camhd', 'inexplique');
  assert (select paranormal from public.events where id = ev), 'strange reports are tagged paranormal';
  assert (select title from public.events where id = ev) = 'Phénomène inexpliqué', 'dominant type wins';
end $$;

reset role;
\o
\echo 'ALL SCHEMA TESTS PASSED'
