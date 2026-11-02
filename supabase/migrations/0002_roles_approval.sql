-- Kartos — 0002: roles, approval of members' contributions, invitation links, graves
--
-- Roles (already in member_role):
--   owner       = Administratorius: everything, approves contributions, manages members
--   editor      = Redaktorius: adds and edits, published immediately
--   contributor = Narys: adds, but waits for the administrator's approval
--   viewer      = Žiūrovas: read only

-- ---------- Approval status ----------
create type content_status as enum ('pending', 'approved', 'rejected');

alter table persons       add column status content_status not null default 'approved';
alter table relationships add column status content_status not null default 'approved';
alter table burials       add column status content_status not null default 'approved';
alter table media         add column status content_status not null default 'approved';
alter table memories      add column status content_status not null default 'approved';

alter table relationships add column created_by uuid references auth.users;

-- Authors default to whoever is signed in.
alter table persons       alter column created_by  set default auth.uid();
alter table relationships alter column created_by  set default auth.uid();
alter table burials       alter column created_by  set default auth.uid();
alter table media         alter column uploader_id set default auth.uid();
alter table memories      alter column author_id   set default auth.uid();

-- Graves: cemetery as free text until the cemetery directory exists.
alter table burials add column cemetery_name text;

-- Invitation links can be used several times until they expire or are revoked.
alter table invitations add column revoked_at timestamptz;
alter table invitations add column use_count int not null default 0;

-- Members see each other's name and email.
alter table profiles add column email text;

-- ---------- Status rules (enforced in the database, not the app) ----------
-- New content from administrators and editors is published; from members it waits.
create or replace function set_initial_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if has_role(new.workspace_id, '{owner,editor}') then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end $$;

-- Only the administrator can approve or reject.
create or replace function guard_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not has_role(new.workspace_id, '{owner}') then
    raise exception 'Only the archive administrator can approve or reject content';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['persons', 'relationships', 'burials', 'media', 'memories'] loop
    execute format('create trigger %I before insert on %I for each row execute function set_initial_status()', t || '_initial_status', t);
    execute format('create trigger %I before update on %I for each row execute function guard_status()', t || '_guard_status', t);
  end loop;
end $$;

-- ---------- Read rules: approved for everyone, pending only for author and administrator ----------
drop policy "members read persons" on persons;
create policy "members read persons" on persons for select using (
  is_member(workspace_id) and (status = 'approved' or created_by = auth.uid() or has_role(workspace_id, '{owner}'))
);

drop policy "members read relationships" on relationships;
create policy "members read relationships" on relationships for select using (
  is_member(workspace_id) and (status = 'approved' or created_by = auth.uid() or has_role(workspace_id, '{owner}'))
);

drop policy "members read burials" on burials;
create policy "members read burials" on burials for select using (
  is_member(workspace_id) and (status = 'approved' or created_by = auth.uid() or has_role(workspace_id, '{owner}'))
);

drop policy "members read media" on media;
create policy "members read media" on media for select using (
  is_member(workspace_id) and (status = 'approved' or uploader_id = auth.uid() or has_role(workspace_id, '{owner}'))
);

drop policy "members read memories" on memories;
create policy "members read memories" on memories for select using (
  is_member(workspace_id) and (status = 'approved' or author_id = auth.uid() or has_role(workspace_id, '{owner}'))
);

-- ---------- Write rules: members add; editors and administrator change and remove ----------
drop policy "contributors write relationships" on relationships;
create policy "contributors add relationships" on relationships for insert
  with check (has_role(workspace_id, '{owner,editor,contributor}'));
create policy "editors change relationships" on relationships for update using (has_role(workspace_id, '{owner,editor}'));
create policy "editors delete relationships" on relationships for delete using (has_role(workspace_id, '{owner,editor}'));

drop policy "contributors write burials" on burials;
create policy "contributors add burials" on burials for insert
  with check (has_role(workspace_id, '{owner,editor,contributor}'));
create policy "editors change burials" on burials for update using (has_role(workspace_id, '{owner,editor}'));
create policy "editors delete burials" on burials for delete using (has_role(workspace_id, '{owner,editor}'));

drop policy "contributors tag" on media_persons;
create policy "contributors tag" on media_persons for insert
  with check (has_role(workspace_id, '{owner,editor,contributor}'));
create policy "editors untag" on media_persons for delete using (has_role(workspace_id, '{owner,editor}'));

drop policy "editors or uploader change media" on media;
create policy "editors change media" on media for update using (has_role(workspace_id, '{owner,editor}'));
create policy "editors delete media" on media for delete using (has_role(workspace_id, '{owner,editor}'));

drop policy "authors edit memories" on memories;
create policy "editors change memories" on memories for update using (has_role(workspace_id, '{owner,editor}'));

-- Persons: only the administrator deletes; editors edit (soft delete is an edit of deleted_at by the administrator in the app).
drop policy "editors delete persons" on persons;
create policy "owner deletes persons" on persons for delete using (has_role(workspace_id, '{owner}'));

-- Invitations: administrator only.
drop policy "owners manage invitations" on invitations;
create policy "owner manages invitations" on invitations for all
  using (has_role(workspace_id, '{owner}')) with check (has_role(workspace_id, '{owner}'));

-- Storage: editors and administrator can remove files.
create policy "editors delete family files" on storage.objects for delete
  using (bucket_id = 'family-media' and has_role(((storage.foldername(name))[1])::uuid, '{owner,editor}'));

-- ---------- An archive always keeps at least one administrator ----------
create or replace function keep_an_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from workspaces where id = old.workspace_id)
     and not exists (
       select 1 from workspace_members
       where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id
     ) then
    raise exception 'An archive needs at least one administrator';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger workspace_members_keep_owner before update or delete on workspace_members
  for each row execute function keep_an_owner();

-- ---------- Profiles visible to fellow members ----------
create or replace function shares_workspace(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members a
    join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
create policy "co-members read profiles" on profiles for select using (shares_workspace(id));

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

insert into profiles (id, display_name, email)
select id, split_part(email, '@', 1), email from auth.users
on conflict (id) do update set email = excluded.email;

-- ---------- Invitation links ----------
-- The link carries a random token; the database stores only its SHA-256 hash.
create or replace function invitation_preview(p_token text)
returns table (workspace_name text, inviter_name text, role member_role, valid boolean)
language sql stable security definer set search_path = public as $$
  select w.name, coalesce(p.display_name, ''), i.role, (i.revoked_at is null and i.expires_at > now())
  from invitations i
  join workspaces w on w.id = i.workspace_id
  left join profiles p on p.id = i.invited_by
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invitations;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select * into inv from invitations where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if inv.id is null or inv.revoked_at is not null or inv.expires_at < now() then
    return null;
  end if;
  insert into workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;
  update invitations set accepted_at = coalesce(accepted_at, now()), use_count = use_count + 1 where id = inv.id;
  return inv.workspace_id;
end $$;

revoke all on function accept_invitation(text) from public, anon;
grant execute on function accept_invitation(text) to authenticated;
grant execute on function invitation_preview(text) to anon, authenticated;

-- ---------- Faster lookups for the approval queue and the tree ----------
create index if not exists persons_pending on persons (workspace_id) where status = 'pending';
create index if not exists relationships_people on relationships (person_a, person_b);
create index if not exists memories_person on memories (person_id);
create index if not exists burials_person on burials (person_id);
create index if not exists media_persons_person on media_persons (person_id);
