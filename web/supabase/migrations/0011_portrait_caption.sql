-- Text the owner wants on the portrait (name plate / illustration caption).
alter table portraits add column if not exists caption text;
