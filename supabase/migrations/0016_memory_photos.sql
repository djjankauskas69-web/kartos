-- Kartos — 0016: a memory can carry up to three photos (media_id stays the first one).
alter table memories add column if not exists media_ids uuid[] not null default '{}';
update memories set media_ids = array[media_id] where media_id is not null and media_ids = '{}';
alter table memories drop constraint if exists memories_three_photos;
alter table memories add constraint memories_three_photos check (coalesce(array_length(media_ids, 1), 0) <= 3);
