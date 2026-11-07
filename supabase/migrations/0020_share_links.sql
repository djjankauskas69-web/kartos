-- Kartos — 0020: a link to look at the family tree without an account.
-- The administrator makes it, chooses what it shows, and can switch it off at any time.
-- The shared page itself reads with the server's key after checking the link, so nothing
-- here opens the family's data to the public.
create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  token text not null unique,
  created_by uuid references auth.users default auth.uid(),
  root_person_id uuid references persons on delete set null,
  include_stories boolean not null default true,
  include_photos boolean not null default true,
  include_graves boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_links_ws on share_links (workspace_id);

alter table share_links enable row level security;
drop policy if exists "owners manage share links" on share_links;
create policy "owners manage share links" on share_links for all
  using (has_role(workspace_id, array['owner']::member_role[]))
  with check (has_role(workspace_id, array['owner']::member_role[]));
