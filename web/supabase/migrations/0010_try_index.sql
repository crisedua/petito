-- Free tries on the landing are counted per device per day.
create index if not exists portraits_device_day on portraits (device_id, created_at desc) where user_id is null;
