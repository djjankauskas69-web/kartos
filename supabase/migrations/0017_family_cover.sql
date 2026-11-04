-- Kartos — 0017: the administrator can put the family's own photo on the overview's cover.
alter table workspaces add column if not exists cover_path text;
