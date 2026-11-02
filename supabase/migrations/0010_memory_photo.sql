-- Kartos — 0010: a memory (story) can carry one photo. The photo itself lives in the archive,
-- tagged with the person, so it also shows among their photos.
alter table memories add column if not exists media_id uuid references media on delete set null;
