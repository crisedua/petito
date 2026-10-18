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
