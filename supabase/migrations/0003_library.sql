-- Kartos — 0003: the archive as a family library
-- Photos, documents (PDF or scans) and written stories, in folders, with a date or period,
-- a place, a description and the people they belong to.

-- ---------- Folders ----------
create table media_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  preset text, -- built-in folder (name translated in the app) unless renamed
  name text check (name is null or char_length(name) between 1 and 80),
  sort int not null default 100,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  check (preset is not null or name is not null)
);
create index on media_folders (workspace_id);
alter table media_folders enable row level security;

create policy "members read folders" on media_folders for select using (is_member(workspace_id));
create policy "editors add folders" on media_folders for insert with check (has_role(workspace_id, '{owner,editor}'));
create policy "editors change folders" on media_folders for update using (has_role(workspace_id, '{owner,editor}'));
create policy "editors delete folders" on media_folders for delete using (has_role(workspace_id, '{owner,editor}'));

-- Every archive starts with the same six folders.
create or replace function add_default_folders(ws uuid) returns void
language sql security definer set search_path = public as $$
  insert into media_folders (workspace_id, preset, sort, created_by)
  select ws, p.preset, p.sort, null
  from (values ('old_photos', 10), ('documents', 20), ('letters', 30), ('military', 40), ('celebrations', 50), ('other', 90)) as p(preset, sort)
  where not exists (select 1 from media_folders f where f.workspace_id = ws and f.preset = p.preset);
$$;

create or replace function default_folders_on_workspace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform add_default_folders(new.id);
  return new;
end $$;
create trigger workspace_default_folders after insert on workspaces
  for each row execute function default_folders_on_workspace();

select add_default_folders(id) from workspaces;

-- ---------- Richer archive items ----------
-- kind: photo | document | story (stories are text only, no file)
alter table media alter column kind drop default;
alter table media alter column kind type text using kind::text;
alter table media alter column kind set default 'photo';
alter table media add constraint media_kind_check check (kind in ('photo', 'document', 'story'));
alter table media alter column storage_path drop not null;
alter table media add constraint media_file_unless_story check (kind = 'story' or storage_path is not null);

alter table media add column folder_id uuid references media_folders on delete set null;
alter table media add column place text;
-- Date or period (taken_year = the year or the start): exact, about, or between taken_year and year_to.
alter table media add column year_qualifier text not null default 'exact' check (year_qualifier in ('exact', 'about', 'between'));
alter table media add column year_to int;
alter table media add column file_name text;
alter table media add column mime_type text;
alter table media add column size_bytes bigint;
create index if not exists media_folder on media (folder_id);

-- Members may fix the details of their own items while they wait for approval.
drop policy if exists "editors change media" on media;
create policy "editors or pending author change media" on media for update using (
  has_role(workspace_id, '{owner,editor}') or (uploader_id = auth.uid() and status = 'pending')
);
-- …and remove their own tags while pending.
create policy "pending author untags" on media_persons for delete using (
  exists (select 1 from media m where m.id = media_id and m.uploader_id = auth.uid() and m.status = 'pending')
);
