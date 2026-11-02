-- Family links: one person in this archive is the same person as one in another family's archive
-- (e.g. a wife who is in her husband's tree and in her own parents' tree).
-- The other family's tree is only ever opened through its own archive, so its people stay
-- visible only to that archive's members; the link itself just says "these two are one person".

create table if not exists family_links (
  id uuid primary key default gen_random_uuid(),
  a_workspace uuid not null references workspaces on delete cascade,
  a_person uuid not null references persons on delete cascade,
  b_workspace uuid references workspaces on delete cascade,
  b_person uuid references persons on delete cascade,
  -- While waiting for the other family: the SHA-256 of the invitation token.
  token_hash text unique,
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  accepted_by uuid references auth.users,
  accepted_at timestamptz,
  check (b_workspace is null or b_workspace <> a_workspace)
);
create index if not exists family_links_a on family_links (a_workspace);
create index if not exists family_links_b on family_links (b_workspace);
create unique index if not exists family_links_pair on family_links (a_person, b_person) where b_person is not null;

alter table family_links enable row level security;

drop policy if exists family_links_read on family_links;
create policy family_links_read on family_links for select
  using (is_member(a_workspace) or (b_workspace is not null and is_member(b_workspace)));

-- Either family's administrator can remove the link.
drop policy if exists family_links_delete on family_links;
create policy family_links_delete on family_links for delete
  using (has_role(a_workspace, '{owner}') or (b_workspace is not null and has_role(b_workspace, '{owner}')));
-- Links are created and accepted only through the functions below.

create or replace function person_workspace(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from persons where id = p and deleted_at is null;
$$;

-- Administrator of both archives: link right away.
create or replace function link_families_direct(p_person uuid, p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ws_a uuid := person_workspace(p_person);
  ws_b uuid := person_workspace(p_other);
  new_id uuid;
begin
  if ws_a is null or ws_b is null or ws_a = ws_b then
    raise exception 'Pick a person from another archive';
  end if;
  if not has_role(ws_a, '{owner}') or not has_role(ws_b, '{owner}') then
    raise exception 'Only the administrator of both archives can link them';
  end if;
  insert into family_links (a_workspace, a_person, b_workspace, b_person, accepted_by, accepted_at)
  values (ws_a, p_person, ws_b, p_other, auth.uid(), now())
  on conflict do nothing
  returning id into new_id;
  return new_id;
end $$;

-- Administrator of this archive: invitation for the other family's administrator.
create or replace function create_family_link(p_person uuid, p_token_hash text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ws uuid := person_workspace(p_person);
  new_id uuid;
begin
  if ws is null or not has_role(ws, '{owner}') then
    raise exception 'Only the administrator can link family trees';
  end if;
  insert into family_links (a_workspace, a_person, token_hash)
  values (ws, p_person, p_token_hash)
  returning id into new_id;
  return new_id;
end $$;

create or replace function family_link_preview(p_token text)
returns table (workspace_name text, person_name text, valid boolean)
language sql stable security definer set search_path = public as $$
  select w.name, trim(p.given_names || ' ' || coalesce(p.surname, '')), (l.b_person is null and l.expires_at > now())
  from family_links l
  join workspaces w on w.id = l.a_workspace
  join persons p on p.id = l.a_person
  where l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- The other family's administrator picks the same person in their own archive.
create or replace function accept_family_link(p_token text, p_person uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l family_links;
  ws uuid := person_workspace(p_person);
begin
  select * into l from family_links where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if l.id is null or l.b_person is not null or l.expires_at < now() then
    return null;
  end if;
  if ws is null or ws = l.a_workspace or not has_role(ws, '{owner}') then
    raise exception 'Pick a person from an archive you administer';
  end if;
  update family_links
     set b_workspace = ws, b_person = p_person, accepted_by = auth.uid(), accepted_at = now(), token_hash = null
   where id = l.id;
  return ws;
end $$;

revoke all on function link_families_direct(uuid, uuid) from public, anon;
revoke all on function create_family_link(uuid, text) from public, anon;
revoke all on function accept_family_link(text, uuid) from public, anon;
revoke all on function person_workspace(uuid) from public, anon;
grant execute on function link_families_direct(uuid, uuid) to authenticated;
grant execute on function create_family_link(uuid, text) to authenticated;
grant execute on function accept_family_link(text, uuid) to authenticated;
grant execute on function person_workspace(uuid) to authenticated;
grant execute on function family_link_preview(text) to anon, authenticated;
