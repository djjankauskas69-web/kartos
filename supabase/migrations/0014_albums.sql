-- Kartos — 0014: the archive's folders become family albums.
-- An album has a date or year, a short description, a cover photo, the people it is about,
-- and who may see it (only this family, or also the families allowed to see it).
-- Any member who may add things may create an album; the one who made it may change it.

alter table media_folders add column if not exists description text check (description is null or char_length(description) <= 2000);
alter table media_folders add column if not exists year int check (year is null or year between 1000 and 2100);
alter table media_folders add column if not exists cover_id uuid references media on delete set null;
alter table media_folders add column if not exists people uuid[] not null default '{}';
alter table media_folders add column if not exists shared boolean not null default false;

drop policy if exists "editors add folders" on media_folders;
drop policy if exists "members add folders" on media_folders;
create policy "members add folders" on media_folders for insert
  with check (has_role(workspace_id, '{owner,editor,contributor}'));

drop policy if exists "editors change folders" on media_folders;
drop policy if exists "editors or creator change folders" on media_folders;
create policy "editors or creator change folders" on media_folders for update
  using (has_role(workspace_id, '{owner,editor}') or (created_by = auth.uid() and is_member(workspace_id)));
