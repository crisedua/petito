-- Admin user management: admins chosen from the panel (on top of ADMIN_EMAILS), suspended
-- accounts, and a private note only admins see.
alter table app_users add column if not exists is_admin boolean not null default false;
alter table app_users add column if not exists suspended_at timestamptz;
alter table app_users add column if not exists admin_note text check (admin_note is null or char_length(admin_note) <= 2000);
