-- Kartos — 0013: seeing another family's tree, with their permission.
-- When someone in your tree is also in another family's tree (a family link, or the same member
-- being "this is me" in both), and that family lets others know they have a tree, you can ask to
-- see it. If they allow it, your archive sees only: names and surnames, years (not the birth year
-- of living people), graves, and what they share with linked families. Nothing can be changed.

alter table workspaces add column if not exists discoverable boolean not null default false;

create table if not exists tree_access (
  id uuid primary key default gen_random_uuid(),
  requester_ws uuid not null references workspaces on delete cascade,
  owner_ws uuid not null references workspaces on delete cascade,
  requested_by uuid references auth.users default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users,
  decided_at timestamptz,
  unique (requester_ws, owner_ws),
  check (requester_ws <> owner_ws)
);
alter table tree_access enable row level security;
drop policy if exists tree_access_read on tree_access;
create policy tree_access_read on tree_access for select using (is_member(requester_ws) or has_role(owner_ws, '{owner}'));

-- People in archive `ws` who are also someone in another archive (that the user is not in).
create or replace function linked_elsewhere(ws uuid)
returns table (my_person uuid, other_ws uuid, other_name text, other_person uuid, status text)
language sql stable security definer set search_path = public as $$
  with pairs as (
    select fl.a_person as mine, fl.b_workspace as ows, fl.b_person as theirs
    from family_links fl where fl.accepted_at is not null and fl.a_workspace = ws and fl.b_workspace is not null
    union
    select fl.b_person, fl.a_workspace, fl.a_person
    from family_links fl where fl.accepted_at is not null and fl.b_workspace = ws
    union
    select wa.person_id, wb.workspace_id, wb.person_id
    from workspace_members wa
    join workspace_members wb on wb.user_id = wa.user_id and wb.workspace_id <> wa.workspace_id and wb.person_id is not null
    where wa.workspace_id = ws and wa.person_id is not null
  )
  select distinct on (p.mine, p.ows) p.mine, p.ows, w.name, p.theirs, ta.status
  from pairs p
  join workspaces w on w.id = p.ows
  join persons mp on mp.id = p.mine and mp.deleted_at is null
  left join tree_access ta on ta.requester_ws = ws and ta.owner_ws = p.ows
  where is_member(ws) and not is_member(p.ows)
    and (w.discoverable or ta.status = 'approved');
$$;

-- Ask to see another family's tree (from an archive you are in, through someone you share).
create or replace function request_tree_access(via uuid, owner uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(via) then raise exception 'not a member'; end if;
  if not exists (select 1 from linked_elsewhere(via) le where le.other_ws = owner) then raise exception 'not linked'; end if;
  insert into tree_access (requester_ws, owner_ws, requested_by, status)
  values (via, owner, auth.uid(), 'pending')
  on conflict (requester_ws, owner_ws) do update
    set status = case when tree_access.status = 'approved' then 'approved' else 'pending' end,
        requested_by = auth.uid(), created_at = case when tree_access.status = 'approved' then tree_access.created_at else now() end;
  return (select status from tree_access where requester_ws = via and owner_ws = owner);
end $$;

-- The administrator of the family being asked: who asks, and who already sees.
create or replace function tree_access_list(ws uuid)
returns table (id uuid, requester_name text, requested_by_name text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select ta.id, w.name, coalesce(pr.display_name, pr.email, ''), ta.status, ta.created_at
  from tree_access ta
  join workspaces w on w.id = ta.requester_ws
  left join profiles pr on pr.id = ta.requested_by
  where ta.owner_ws = ws and has_role(ws, '{owner}') and ta.status in ('pending', 'approved')
  order by ta.status desc, ta.created_at desc;
$$;

create or replace function decide_tree_access(req uuid, decision text) returns void
language plpgsql security definer set search_path = public as $$
declare
  ta tree_access;
begin
  select * into ta from tree_access where id = req;
  if ta.id is null or not has_role(ta.owner_ws, '{owner}') then raise exception 'not allowed'; end if;
  if decision not in ('approved', 'rejected', 'revoked') then raise exception 'bad decision'; end if;
  update tree_access set status = decision, decided_by = auth.uid(), decided_at = now() where id = req;
end $$;

create or replace function set_discoverable(ws uuid, value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(ws, '{owner}') then raise exception 'not allowed'; end if;
  update workspaces set discoverable = value where id = ws;
end $$;

-- Does the user see the tree of archive `owner` through an archive they are in?
create or replace function sees_tree(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tree_access ta where ta.owner_ws = owner and ta.status = 'approved' and is_member(ta.requester_ws));
$$;

-- What a family that allowed it shows: names, years (no birth year for the living), graves.
create or replace function shared_tree(owner uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when not sees_tree(owner) then null else json_build_object(
    'name', (select name from workspaces where id = owner),
    'people', coalesce((select json_agg(json_build_object(
        'id', p.id, 'given_names', p.given_names, 'surname', p.surname, 'sex', p.sex, 'is_living', p.is_living,
        'birth_year', case when p.is_living then null else p.birth_year end,
        'death_year', case when p.is_living then null else p.death_year end))
      from persons p where p.workspace_id = owner and p.deleted_at is null and p.status = 'approved'), '[]'::json),
    'rels', coalesce((select json_agg(json_build_object('id', r.id, 'person_a', r.person_a, 'person_b', r.person_b, 'type', r.type))
      from relationships r where r.workspace_id = owner and r.status = 'approved'), '[]'::json),
    'graves', coalesce((select json_agg(json_build_object('person_id', b.person_id, 'cemetery_name', b.cemetery_name, 'lat', b.lat, 'lng', b.lng))
      from burials b join persons p on p.id = b.person_id
      where b.workspace_id = owner and b.status = 'approved' and not p.is_living), '[]'::json)
  ) end;
$$;

-- What they share about one person also reaches the families allowed to see their tree.
create or replace function sees_shared(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_links fl
    where fl.accepted_at is not null
      and ((fl.a_person = p and fl.b_workspace is not null and is_member(fl.b_workspace))
        or (fl.b_person = p and is_member(fl.a_workspace)))
  ) or exists (
    select 1
    from workspace_members wa
    join workspace_members wb on wb.user_id = wa.user_id and wb.workspace_id <> wa.workspace_id and wb.person_id is not null
    where wa.person_id = p and is_member(wb.workspace_id)
  ) or exists (
    select 1 from persons pp where pp.id = p and sees_tree(pp.workspace_id)
  );
$$;

-- An invitation says whom it was meant for, so the page can warn about signing in as someone else.
create or replace function invitation_email(p_token text) returns text
language sql stable security definer set search_path = public as $$
  select i.email from invitations i where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and i.revoked_at is null;
$$;

grant execute on function linked_elsewhere(uuid), request_tree_access(uuid, uuid), tree_access_list(uuid), decide_tree_access(uuid, text), set_discoverable(uuid, boolean), sees_tree(uuid), shared_tree(uuid), sees_shared(uuid), invitation_email(text) to authenticated;
grant execute on function invitation_email(text) to anon;
