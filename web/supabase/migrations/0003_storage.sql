-- Private media bucket. Objects live at {owner_id}/{name}; they are served only through the app's
-- /api/media proxy (service role), never directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','video/mp4','application/octet-stream'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
