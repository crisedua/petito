-- Frame chosen for a royal/Halloween portrait (dorado, madera, negro_gotico, plata, sin_marco).
-- Empty means the style's default frame.
alter table portraits add column if not exists frame text;
