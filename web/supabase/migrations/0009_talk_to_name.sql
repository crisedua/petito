-- Talking video dedicated to someone: the pet addresses this person by name.
alter table videos add column if not exists to_name text;
