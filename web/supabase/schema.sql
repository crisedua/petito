-- Petito: full schema. Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- ===== 0001_schema.sql =====
-- Petito schema. Ids are app-generated text (uuid strings, "user_" ids, 10-hex slugs) so rows
-- migrated from the legacy MongoDB keep their ids and every existing share link keeps working.

create table if not exists app_users (
  user_id       text primary key,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         text not null unique,
  name          text,
  picture       text,
  created_at    timestamptz not null default now()
);

create table if not exists subscriptions (
  mp_id              text primary key,
  user_id            text not null references app_users(user_id) on delete cascade,
  plan               text not null check (plan in ('monthly','annual')),
  external_reference text,
  payer_email        text,
  status             text,
  membership_active  boolean not null default false,
  plus_until         timestamptz,
  next_payment_date  text,
  courtesy           boolean not null default false,
  created_at         timestamptz not null default now()
);

create table if not exists pets (
  id               text primary key,
  share_slug       text not null unique,
  user_id          text not null references app_users(user_id) on delete cascade,
  name             text not null,
  species          text not null default 'perro',
  personality      text[] not null default '{}',
  personality_text text,
  favorite_memory  text,
  photo_file       text,
  intro_text       text,
  birthday         text,
  adoption_date    text,
  public_enabled   boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists memories (
  id            text primary key,
  pet_id        text not null references pets(id) on delete cascade,
  user_id       text not null references app_users(user_id) on delete cascade,
  title         text not null default '',
  happened_on   text,
  date_unknown  boolean not null default false,
  feeling_text  text,
  emotions      text[] not null default '{}',
  photo_file    text,
  ai_reflection text,
  shared        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists stories (
  id                text primary key,
  share_slug        text not null unique,
  device_id         text,
  user_id           text references app_users(user_id) on delete set null,
  pet_id            text references pets(id) on delete set null,
  pet_name          text not null,
  species           text not null default 'otro',
  traits            text[] not null default '{}',
  theme             text not null,
  status            text not null default 'draft',
  progress_step     text not null default '',
  progress_pct      integer not null default 0,
  bonus_pending     boolean not null default false,
  narration_pending boolean not null default false,
  voice_id          text,
  title             text,
  price_clp         integer not null default 3990,
  paid_at           timestamptz,
  email             text,
  bonus_enabled     boolean not null default true,
  ai_cost_usd       numeric(10,6) not null default 0,
  error             text,
  photo_count       integer not null default 0,
  generated_at      timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz
);

create table if not exists story_photos (
  id         text primary key,
  story_id   text not null references stories(id) on delete cascade,
  idx        integer not null,
  file       text not null,
  created_at timestamptz not null default now(),
  unique (story_id, idx)
);

create table if not exists slides (
  id          text primary key,
  story_id    text not null references stories(id) on delete cascade,
  ord         integer not null,
  caption     text not null default '',
  kind        text not null default 'photo',
  image_file  text not null default '',
  audio_file  text not null default '',
  locked_file text not null default '',
  locked      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (story_id, ord)
);

create table if not exists portraits (
  id               text primary key,
  share_slug       text not null unique,
  device_id        text,
  user_id          text references app_users(user_id) on delete set null,
  pet_id           text references pets(id) on delete set null,
  pet_name         text,
  style            text not null,
  category         text not null default 'royal',
  status           text not null default 'draft',
  progress_step    text not null default '',
  progress_pct     integer not null default 0,
  preview_file     text not null default '',
  clean_file       text not null default '',
  price_clp        integer not null default 2990,
  paid_at          timestamptz,
  gift_enabled     boolean not null default false,
  gift_to          text,
  gift_from        text,
  gift_message     text,
  memorial_dates   text,
  memorial_caption text,
  ai_cost_usd      numeric(10,6) not null default 0,
  error            text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);

create table if not exists portrait_photos (
  id          text primary key,
  portrait_id text not null references portraits(id) on delete cascade,
  file        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists videos (
  id            text primary key,
  share_slug    text not null unique,
  device_id     text,
  user_id       text references app_users(user_id) on delete set null,
  pet_id        text references pets(id) on delete set null,
  pet_name      text,
  species       text,
  mode          text not null default 'full',
  status        text not null default 'draft',
  scenario      text,
  message       text,
  progress_step text not null default '',
  progress_pct  integer not null default 0,
  line          text,
  voice_id      text,
  media_base    text,
  preview_file  text not null default '',
  clean_file    text not null default '',
  price_clp     integer not null default 2990,
  paid_at       timestamptz,
  ai_cost_usd   numeric(10,6) not null default 0,
  error         text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);

create table if not exists talk_photos (
  id         text primary key,
  video_id   text not null references videos(id) on delete cascade,
  file       text not null,
  created_at timestamptz not null default now()
);

-- owner_id may be a story, portrait, video, pet or memory id (no FK on purpose).
create table if not exists generation_logs (
  id            text primary key,
  owner_id      text not null,
  step          text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  images        integer not null default 0,
  cost_usd      numeric(10,6) not null default 0,
  duration_ms   integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists survey_responses (
  id         text primary key,
  device_id  text not null default '',
  story_id   text not null default '',
  answer     text not null check (answer in ('yes','no')),
  price_clp  integer not null default 9900,
  created_at timestamptz not null default now()
);

-- All access goes through the app's server code with the service-role key; nothing is exposed to
-- anon/authenticated roles directly. RLS on with no policies = deny-all for those roles.
do $$
declare t text;
begin
  foreach t in array array['app_users','subscriptions','pets','memories','stories','story_photos','slides',
                           'portraits','portrait_photos','videos','talk_photos','generation_logs','survey_responses']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ===== 0002_indexes.sql =====
create index if not exists stories_user_created on stories (user_id, created_at desc);
create index if not exists stories_pet on stories (pet_id);
create index if not exists stories_device_generated on stories (device_id, generated_at);
create index if not exists stories_status on stories (status);
create index if not exists slides_story_ord on slides (story_id, ord);
create index if not exists story_photos_story on story_photos (story_id, idx);
create index if not exists portraits_user on portraits (user_id, created_at desc);
create index if not exists portraits_pet on portraits (pet_id);
create index if not exists videos_user on videos (user_id, created_at desc);
create index if not exists videos_pet on videos (pet_id);
create index if not exists videos_device_mode_created on videos (device_id, mode, created_at);
create index if not exists pets_user on pets (user_id, created_at);
create index if not exists pets_public_slug on pets (share_slug) where public_enabled;
create index if not exists memories_pet_created on memories (pet_id, created_at desc);
create index if not exists memories_user_created on memories (user_id, created_at);
create index if not exists subscriptions_user_created on subscriptions (user_id, created_at desc);
create index if not exists subscriptions_user_active on subscriptions (user_id) where membership_active;
create index if not exists generation_logs_owner on generation_logs (owner_id);
create index if not exists survey_device on survey_responses (device_id);
create index if not exists app_users_email_lower on app_users (lower(email));

-- ===== 0003_storage.sql =====
-- Private media bucket. Objects live at {owner_id}/{name}; they are served only through the app's
-- /api/media proxy (service role), never directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','video/mp4','application/octet-stream'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ===== 0004_admin_fn.sql =====
-- One round trip for /api/admin/metrics.
create or replace function admin_metrics()
returns table (total_stories bigint, paid_stories bigint, total_cost_usd numeric)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where status <> 'draft'),
    count(*) filter (where status = 'paid'),
    coalesce(sum(ai_cost_usd), 0)
  from stories;
$$;
revoke all on function admin_metrics() from public, anon, authenticated;

-- ===== 0005_social.sql =====
-- Amigos de Petito: owners connect with owners they choose and share creations and memories with them.

-- Personal invite code behind each owner's "conectar" link (created on first use).
alter table app_users add column if not exists friend_code text unique;

-- One row per pair of owners. requester_id asked, addressee_id answers. Pending until accepted;
-- declining or removing deletes the row.
create table if not exists connections (
  id            text primary key,
  requester_id  text not null references app_users(user_id) on delete cascade,
  addressee_id  text not null references app_users(user_id) on delete cascade,
  status        text not null check (status in ('pending','accepted')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists connections_pair on connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists connections_requester on connections (requester_id, status);
create index if not exists connections_addressee on connections (addressee_id, status);

-- Something an owner shared with all their connections.
create table if not exists shares (
  id          text primary key,
  user_id     text not null references app_users(user_id) on delete cascade,
  pet_id      text references pets(id) on delete set null,
  kind        text not null check (kind in ('story','portrait','video','memory')),
  item_id     text not null,
  note        text check (note is null or char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  unique (user_id, kind, item_id)
);
create index if not exists shares_user_created on shares (user_id, created_at desc);

create table if not exists share_reactions (
  share_id    text not null references shares(id) on delete cascade,
  user_id     text not null references app_users(user_id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (share_id, user_id)
);

create table if not exists share_comments (
  id          text primary key,
  share_id    text not null references shares(id) on delete cascade,
  user_id     text not null references app_users(user_id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists share_comments_share on share_comments (share_id, created_at);

alter table connections enable row level security;
alter table shares enable row level security;
alter table share_reactions enable row level security;
alter table share_comments enable row level security;

-- ===== 0006_admin_users.sql =====
-- Admin user management: admins chosen from the panel (on top of ADMIN_EMAILS), suspended
-- accounts, and a private note only admins see.
alter table app_users add column if not exists is_admin boolean not null default false;
alter table app_users add column if not exists suspended_at timestamptz;
alter table app_users add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 2000);

-- ===== 0007_events.sql =====
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

-- ===== 0008_portrait_frame.sql =====
-- Frame chosen for a royal/Halloween portrait (dorado, madera, negro_gotico, plata, sin_marco).
-- Empty means the style's default frame.
alter table portraits add column if not exists frame text;

-- ===== 0009_talk_to_name.sql =====
-- Talking video dedicated to someone: the pet addresses this person by name.
alter table videos add column if not exists to_name text;

-- 0010_try_index.sql
create index if not exists portraits_device_day on portraits (device_id, created_at desc) where user_id is null;

-- ===== 0011_portrait_caption.sql =====
alter table portraits add column if not exists caption text;
