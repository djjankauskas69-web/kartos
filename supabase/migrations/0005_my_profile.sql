-- Kartos — 0005: "this is me" — link each member to their own person in the tree.
-- Members edit their own person (name, birth year, place, photo) straight away, without approval.

alter table workspace_members add column if not exists person_id uuid references persons on delete set null;
create unique index if not exists workspace_members_one_per_person
  on workspace_members (workspace_id, person_id) where person_id is not null;

-- Self-edits run only through the functions below. They mark the transaction so the
-- approval triggers treat the change as approved. Clients can't set this flag themselves.
create or replace function self_edit_on() returns boolean
language sql stable as $$
  select coalesce(current_setting('kartos.self_edit', true), '') = coalesce(auth.uid()::text, '-');
$$;

create or replace function set_initial_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if has_role(new.workspace_id, '{owner,editor}') or self_edit_on() then
    new.status := 'approved';
  else
    new.status := 'pending';
  end if;
  return new;
end $$;

create or replace function guard_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not has_role(new.workspace_id, '{owner}') and not self_edit_on() then
    raise exception 'Only the archive administrator can approve or reject content';
  end if;
  return new;
end $$;

-- The caller's own person in an archive (null when not linked).
create or replace function my_person(ws uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select person_id from workspace_members where workspace_id = ws and user_id = auth.uid();
$$;

-- Shared checks for linking: the person is in this archive, not deleted, and nobody else has it.
create or replace function check_linkable(ws uuid, p uuid, for_user uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from persons where id = p and workspace_id = ws and deleted_at is null and status <> 'rejected') then
    raise exception 'person not found';
  end if;
  if exists (select 1 from workspace_members where workspace_id = ws and person_id = p and user_id <> for_user) then
    raise exception 'already linked';
  end if;
end $$;

-- "This is me": a member picks themselves (or clears it with null).
create or replace function claim_person(ws uuid, p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(ws) then raise exception 'not a member'; end if;
  if p is not null then perform check_linkable(ws, p, auth.uid()); end if;
  update workspace_members set person_id = p where workspace_id = ws and user_id = auth.uid();
end $$;

-- The administrator can fix anyone's link.
create or replace function admin_link_person(ws uuid, member uuid, p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(ws, '{owner}') then raise exception 'only the administrator'; end if;
  if p is not null then perform check_linkable(ws, p, member); end if;
  update workspace_members set person_id = p where workspace_id = ws and user_id = member;
end $$;

-- "I'm not in the tree yet": creates the caller as a living person and links them.
create or replace function create_my_person(ws uuid, p_given text, p_surname text, p_birth_year int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not is_member(ws) then raise exception 'not a member'; end if;
  if my_person(ws) is not null then raise exception 'already linked'; end if;
  if coalesce(trim(p_given), '') = '' then raise exception 'name required'; end if;
  perform set_config('kartos.self_edit', auth.uid()::text, true);
  insert into persons (workspace_id, given_names, surname, birth_year, is_living, created_by)
  values (ws, trim(p_given), nullif(trim(p_surname), ''), p_birth_year, true, auth.uid())
  returning id into new_id;
  update workspace_members set person_id = new_id where workspace_id = ws and user_id = auth.uid();
  perform set_config('kartos.self_edit', '', true);
  return new_id;
end $$;

-- Edits the caller's own person.
create or replace function update_my_person(
  ws uuid, p_given text, p_surname text, p_birth_surname text, p_birth_year int, p_birth_place text
) returns void
language plpgsql security definer set search_path = public as $$
declare p uuid := my_person(ws);
begin
  if p is null then raise exception 'not linked'; end if;
  if coalesce(trim(p_given), '') = '' then raise exception 'name required'; end if;
  perform set_config('kartos.self_edit', auth.uid()::text, true);
  update persons set
    given_names = trim(p_given),
    surname = nullif(trim(p_surname), ''),
    birth_surname = nullif(trim(p_birth_surname), ''),
    birth_year = p_birth_year,
    birth_place = nullif(trim(p_birth_place), ''),
    status = 'approved',
    updated_at = now()
  where id = p and workspace_id = ws;
  perform set_config('kartos.self_edit', '', true);
end $$;

-- Sets the caller's own portrait from a photo they just uploaded to <ws>/portraits/.
create or replace function set_my_portrait(ws uuid, p_path text, p_width int, p_height int, p_size bigint)
returns uuid
language plpgsql security definer set search_path = public as $$
declare p uuid := my_person(ws); m uuid;
begin
  if p is null then raise exception 'not linked'; end if;
  if p_path not like ws::text || '/portraits/%' then raise exception 'bad path'; end if;
  perform set_config('kartos.self_edit', auth.uid()::text, true);
  insert into media (workspace_id, uploader_id, storage_path, kind, width, height, mime_type, size_bytes)
  values (ws, auth.uid(), p_path, 'photo', p_width, p_height, 'image/jpeg', p_size)
  returning id into m;
  insert into media_persons (media_id, person_id, workspace_id) values (m, p, ws);
  update persons set profile_photo_id = m, updated_at = now() where id = p;
  perform set_config('kartos.self_edit', '', true);
  return m;
end $$;

-- Everyone in the archive, including view-only members, may upload their own portrait.
drop policy if exists "members upload own portrait" on storage.objects;
create policy "members upload own portrait" on storage.objects for insert
  with check (
    bucket_id = 'family-media'
    and (storage.foldername(name))[2] = 'portraits'
    and is_member(((storage.foldername(name))[1])::uuid)
  );

revoke all on function self_edit_on() from public, anon;
revoke all on function my_person(uuid) from public, anon;
revoke all on function check_linkable(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function claim_person(uuid, uuid) from public, anon;
revoke all on function admin_link_person(uuid, uuid, uuid) from public, anon;
revoke all on function create_my_person(uuid, text, text, int) from public, anon;
revoke all on function update_my_person(uuid, text, text, text, int, text) from public, anon;
revoke all on function set_my_portrait(uuid, text, int, int, bigint) from public, anon;
grant execute on function self_edit_on() to authenticated;
grant execute on function my_person(uuid) to authenticated;
grant execute on function claim_person(uuid, uuid) to authenticated;
grant execute on function admin_link_person(uuid, uuid, uuid) to authenticated;
grant execute on function create_my_person(uuid, text, text, int) to authenticated;
grant execute on function update_my_person(uuid, text, text, text, int, text) to authenticated;
grant execute on function set_my_portrait(uuid, text, int, int, bigint) to authenticated;
