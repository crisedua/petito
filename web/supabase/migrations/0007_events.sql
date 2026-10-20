-- Funnel analytics: one row per thing a visitor does (visit, open a feature, upload a photo, get a
-- result, hit the paywall, start checkout, pay). device_id is the browser's anonymous id (the
-- X-Device-Id the app already sends); user_id is set once they're signed in, which is how anonymous
-- steps connect to sign-in and payment.
create table if not exists events (
  id          bigint generated always as identity primary key,
  name        text not null,
  feature     text,
  device_id   text,
  user_id     text,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_created on events (created_at desc);
create index if not exists events_name_created on events (name, created_at desc);
create index if not exists events_device on events (device_id) where device_id is not null;
create index if not exists events_user on events (user_id) where user_id is not null;
alter table events enable row level security;

-- Funnel per feature since a date, counted in unique visitors (devices; a signed-in user's devices
-- count once through their user_id). "Signed in" and "paid" count visitors who did the earlier step
-- of that feature and, at any point in the period, were signed in / paid.
create or replace function funnel_stats(since timestamptz)
returns jsonb language sql stable as $$
with e as (
  select name, feature, device_id, user_id, props, created_at,
         coalesce(user_id, 'd:' || device_id) as who
  from events where created_at >= since
),
-- a device that ever signed in maps to that user, so its anonymous steps join its later sign-in/payment
dev_user as (
  select device_id, max(user_id) as user_id from events
  where device_id is not null and user_id is not null group by device_id
),
e2 as (
  select e.*, coalesce(e.user_id, du.user_id, 'd:' || e.device_id) as person
  from e left join dev_user du on du.device_id = e.device_id
),
signed as (select distinct person from e2 where user_id is not null or person not like 'd:%'),
paid as (select distinct person, feature from e2 where name = 'paid'),
feats as (select unnest(array['video','portrait','memorial','story','memory','friends']) as feature),
per as (
  select f.feature,
    (select count(distinct person) from e2 where name = 'view_feature' and feature = f.feature) as opened,
    (select count(distinct person) from e2 where name = 'photo_uploaded' and feature = f.feature) as uploaded,
    (select count(distinct person) from e2 where name = 'result_ready' and feature = f.feature) as result,
    (select count(distinct x.person) from e2 x join signed s on s.person = x.person
       where x.name in ('photo_uploaded', 'view_feature') and x.feature = f.feature) as signed_in,
    (select count(distinct person) from e2 where name = 'paywall' and feature = f.feature) as paywall,
    (select count(distinct person) from e2 where name = 'checkout_started' and feature = f.feature) as checkout,
    (select count(distinct person) from paid where feature = f.feature) as paid,
    (select coalesce(sum((props->>'amount')::numeric), 0) from e2 where name = 'paid' and feature = f.feature) as revenue_clp
  from feats f
)
select jsonb_build_object(
  'since', since,
  'visitors', (select count(distinct person) from e2 where name = 'visit'),
  'signed_in', (select count(*) from signed),
  'signups', (select count(distinct person) from e2 where name = 'signup'),
  'paid', (select count(distinct person) from paid),
  'revenue_clp', (select coalesce(sum((props->>'amount')::numeric), 0) from e2 where name = 'paid'),
  'installs', (select count(distinct person) from e2 where name = 'install'),
  'share_opens', (select count(*) from e2 where name = 'share_open'),
  'features', (select jsonb_agg(to_jsonb(per) order by array_position(array['video','portrait','memorial','story','memory','friends'], per.feature)) from per),
  'sources', (select coalesce(jsonb_agg(s order by s.visitors desc), '[]'::jsonb) from (
      select coalesce(nullif(props->>'source', ''), 'directo') as source,
             count(distinct person) as visitors,
             count(distinct person) filter (where person in (select person from paid)) as paid
      from e2 where name = 'visit' group by 1 order by 2 desc limit 12) s),
  'daily', (select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
      select date_trunc('day', created_at at time zone 'America/Santiago')::date as day,
             count(distinct person) filter (where name = 'visit') as visitors,
             count(distinct person) filter (where name = 'photo_uploaded') as uploaded,
             count(distinct person) filter (where name = 'paid') as paid
      from e2 group by 1) d)
);
$$;

-- Only the server (service role) may run it.
revoke execute on function funnel_stats(timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke execute on function funnel_stats(timestamptz) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke execute on function funnel_stats(timestamptz) from authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function funnel_stats(timestamptz) to service_role; end if;
end $$;
