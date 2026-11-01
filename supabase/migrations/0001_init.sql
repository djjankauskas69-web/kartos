-- Kartos — initial schema
-- Every family table carries workspace_id; Row Level Security lets a user
-- touch a row only if they are a member of that workspace.

create extension if not exists "pgcrypto";

-- ---------- Types ----------
create type member_role as enum ('owner', 'editor', 'contributor', 'viewer');
create type visibility as enum ('private', 'unlisted', 'public');
create type date_qualifier as enum ('exact', 'about', 'before', 'after', 'between');
create type relationship_type as enum ('parent_child', 'partner');
create type media_kind as enum ('photo', 'document');
create type suggestion_status as enum ('open', 'accepted', 'rejected');

-- ---------- Accounts ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  locale text not null default 'lt' check (locale in ('lt', 'en')),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text unique,
  plan text not null default 'free',
  default_visibility visibility not null default 'private',
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null default 'viewer',
  person_id uuid, -- "this is me" in the tree; FK added below
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  email text,
  role member_role not null default 'contributor' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid not null references auth.users,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- People ----------
create table persons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  given_names text not null,
  surname text,
  birth_surname text,
  sex text check (sex in ('female', 'male', 'unknown')),
  is_living boolean not null default false,
  -- partial dates: year / month / day + qualifier; *_2 for "between" ranges
  birth_year int, birth_month int check (birth_month between 1 and 12), birth_day int check (birth_day between 1 and 31),
  birth_qualifier date_qualifier not null default 'exact', birth_year_2 int,
  birth_place text,
  death_year int, death_month int check (death_month between 1 and 12), death_day int check (death_day between 1 and 31),
  death_qualifier date_qualifier not null default 'exact', death_year_2 int,
  death_place text,
  biography text,
  visibility visibility not null default 'private',
  share_slug text unique,
  profile_photo_id uuid,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz, -- soft delete, restorable for 30 days
  -- living people are never shared outside the family
  constraint living_stay_private check (not is_living or visibility = 'private')
);
create index on persons (workspace_id) where deleted_at is null;
create index on persons (workspace_id, surname);

alter table workspace_members
  add constraint workspace_members_person_fk foreign key (person_id) references persons on delete set null;

create table relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  person_a uuid not null references persons on delete cascade, -- parent, or partner
  person_b uuid not null references persons on delete cascade, -- child, or partner
  type relationship_type not null,
  subtype text, -- biological | adopted | step | foster  /  married | divorced | partner
  start_year int,
  end_year int,
  created_at timestamptz not null default now(),
  check (person_a <> person_b),
  unique (person_a, person_b, type)
);
create index on relationships (workspace_id);

-- ---------- Graves ----------
create table cemeteries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  country text,
  osm_id text unique,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create table burials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  person_id uuid not null references persons on delete cascade,
  cemetery_id uuid references cemeteries,
  lat double precision,
  lng double precision,
  accuracy_m real,
  section text,
  row_label text,
  plot text,
  directions_note text,
  photo_id uuid,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create index on burials (workspace_id);

-- ---------- Archive ----------
create table media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  uploader_id uuid references auth.users,
  storage_path text not null unique, -- bucket "family-media", path starts with workspace_id/
  kind media_kind not null default 'photo',
  title text,
  description text,
  taken_year int,
  width int,
  height int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on media (workspace_id) where deleted_at is null;

create table media_persons (
  media_id uuid not null references media on delete cascade,
  person_id uuid not null references persons on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  primary key (media_id, person_id)
);

alter table persons add constraint persons_photo_fk foreign key (profile_photo_id) references media on delete set null;
alter table burials add constraint burials_photo_fk foreign key (photo_id) references media on delete set null;

create table memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  person_id uuid not null references persons on delete cascade,
  author_id uuid references auth.users,
  body text not null,
  created_at timestamptz not null default now()
);

create table suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  target_table text not null,
  target_id uuid not null,
  proposed_change jsonb not null,
  author_id uuid references auth.users,
  status suggestion_status not null default 'open',
  created_at timestamptz not null default now()
);

create table activity_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces on delete cascade,
  actor_id uuid references auth.users,
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index on activity_log (workspace_id, created_at desc);

-- ---------- Membership helpers (security definer avoids RLS recursion) ----------
create or replace function is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function has_role(ws uuid, roles member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = any (roles)
  );
$$;

-- Creating a workspace makes its creator the owner.
create or replace function add_owner_on_workspace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_members (workspace_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger workspace_owner after insert on workspaces
  for each row execute function add_owner_on_workspace();

-- New account gets a profile.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table invitations enable row level security;
alter table persons enable row level security;
alter table relationships enable row level security;
alter table cemeteries enable row level security;
alter table burials enable row level security;
alter table media enable row level security;
alter table media_persons enable row level security;
alter table memories enable row level security;
alter table suggestions enable row level security;
alter table activity_log enable row level security;

create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "members read workspace" on workspaces for select using (is_member(id));
create policy "anyone signed in creates workspace" on workspaces for insert with check (created_by = auth.uid());
create policy "owners update workspace" on workspaces for update using (has_role(id, '{owner}'));
create policy "owners delete workspace" on workspaces for delete using (has_role(id, '{owner}'));

create policy "members see members" on workspace_members for select using (is_member(workspace_id));
create policy "owners manage members" on workspace_members for all
  using (has_role(workspace_id, '{owner}')) with check (has_role(workspace_id, '{owner}'));
create policy "members can leave" on workspace_members for delete using (user_id = auth.uid());

create policy "owners manage invitations" on invitations for all
  using (has_role(workspace_id, '{owner,editor}')) with check (has_role(workspace_id, '{owner,editor}'));

-- Family content: members read; editors write; contributors add.
create policy "members read persons" on persons for select using (is_member(workspace_id));
create policy "contributors add persons" on persons for insert with check (has_role(workspace_id, '{owner,editor,contributor}'));
create policy "editors change persons" on persons for update using (has_role(workspace_id, '{owner,editor}'));
create policy "editors delete persons" on persons for delete using (has_role(workspace_id, '{owner,editor}'));

create policy "members read relationships" on relationships for select using (is_member(workspace_id));
create policy "contributors write relationships" on relationships for all
  using (has_role(workspace_id, '{owner,editor,contributor}')) with check (has_role(workspace_id, '{owner,editor,contributor}'));

create policy "signed-in read cemeteries" on cemeteries for select using (auth.uid() is not null);
create policy "signed-in add cemeteries" on cemeteries for insert with check (created_by = auth.uid());

create policy "members read burials" on burials for select using (is_member(workspace_id));
create policy "contributors write burials" on burials for all
  using (has_role(workspace_id, '{owner,editor,contributor}')) with check (has_role(workspace_id, '{owner,editor,contributor}'));

create policy "members read media" on media for select using (is_member(workspace_id));
create policy "contributors add media" on media for insert with check (has_role(workspace_id, '{owner,editor,contributor}'));
create policy "editors or uploader change media" on media for update
  using (has_role(workspace_id, '{owner,editor}') or uploader_id = auth.uid());

create policy "members read tags" on media_persons for select using (is_member(workspace_id));
create policy "contributors tag" on media_persons for all
  using (has_role(workspace_id, '{owner,editor,contributor}')) with check (has_role(workspace_id, '{owner,editor,contributor}'));

create policy "members read memories" on memories for select using (is_member(workspace_id));
create policy "contributors add memories" on memories for insert
  with check (has_role(workspace_id, '{owner,editor,contributor}') and author_id = auth.uid());
create policy "authors edit memories" on memories for update using (author_id = auth.uid());
create policy "authors or editors delete memories" on memories for delete
  using (author_id = auth.uid() or has_role(workspace_id, '{owner,editor}'));

create policy "members read suggestions" on suggestions for select using (is_member(workspace_id));
create policy "members suggest" on suggestions for insert with check (is_member(workspace_id) and author_id = auth.uid());
create policy "editors resolve suggestions" on suggestions for update using (has_role(workspace_id, '{owner,editor}'));

create policy "members read activity" on activity_log for select using (is_member(workspace_id));
create policy "members log activity" on activity_log for insert with check (is_member(workspace_id) and actor_id = auth.uid());

-- ---------- Storage: private bucket, folder per workspace ----------
insert into storage.buckets (id, name, public) values ('family-media', 'family-media', false)
  on conflict (id) do nothing;

create policy "members read family files" on storage.objects for select
  using (bucket_id = 'family-media' and is_member(((storage.foldername(name))[1])::uuid));
create policy "contributors upload family files" on storage.objects for insert
  with check (bucket_id = 'family-media' and has_role(((storage.foldername(name))[1])::uuid, '{owner,editor,contributor}'));
