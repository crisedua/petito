-- Talking video with a new background: where the owner wants the pet to appear (empty keeps the photo as is).
alter table videos add column if not exists background text;
