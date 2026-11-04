-- Kartos — 0018: family members can leave short comments under a photo (or document, or story).
create table if not exists media_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  media_id uuid not null references media on delete cascade,
  author_id uuid references auth.users default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists media_comments_media on media_comments (media_id);
alter table media_comments enable row level security;
drop policy if exists "members read comments" on media_comments;
create policy "members read comments" on media_comments for select using (is_member(workspace_id));
drop policy if exists "members comment" on media_comments;
create policy "members comment" on media_comments for insert
  with check (author_id = auth.uid() and has_role(workspace_id, '{owner,editor,contributor}'));
drop policy if exists "author or editors remove comments" on media_comments;
create policy "author or editors remove comments" on media_comments for delete
  using (author_id = auth.uid() or has_role(workspace_id, '{owner,editor}'));
grant select, insert, delete on media_comments to authenticated;
