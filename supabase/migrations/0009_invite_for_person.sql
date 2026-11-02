-- Kartos — 0009: joining the tree as yourself.
--  * An invitation can be made for one person in the tree: accepting it links you to them.
--  * "I'm not in the tree yet" can say where you belong: "I'm the daughter of Petras".

alter table invitations add column if not exists person_id uuid references persons on delete set null;

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
  -- Made for someone in the tree: link them, unless another member already is that person.
  if inv.person_id is not null
     and exists (select 1 from persons where id = inv.person_id and workspace_id = inv.workspace_id and deleted_at is null)
     and not exists (select 1 from workspace_members where workspace_id = inv.workspace_id and person_id = inv.person_id) then
    update workspace_members set person_id = inv.person_id
     where workspace_id = inv.workspace_id and user_id = auth.uid() and person_id is null;
  end if;
  update invitations set accepted_at = coalesce(accepted_at, now()), use_count = use_count + 1 where id = inv.id;
  return inv.workspace_id;
end $$;

-- "I'm not in the tree yet", with where you belong. You appear at once; the new relationship
-- follows the usual approval (members' additions wait for the administrator).
create or replace function create_my_person_related(
  ws uuid, p_given text, p_surname text, p_birth_year int, p_sex text, p_kind text, p_relative uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  par uuid;
begin
  if not is_member(ws) then raise exception 'not a member'; end if;
  if my_person(ws) is not null then raise exception 'already linked'; end if;
  if coalesce(trim(p_given), '') = '' then raise exception 'name required'; end if;
  if p_kind not in ('child', 'parent', 'partner', 'sibling') then raise exception 'bad kind'; end if;
  if not exists (select 1 from persons where id = p_relative and workspace_id = ws and deleted_at is null and status <> 'rejected') then
    raise exception 'person not found';
  end if;
  if p_kind = 'sibling' and not exists (select 1 from relationships where workspace_id = ws and type = 'parent_child' and person_b = p_relative and status <> 'rejected') then
    raise exception 'no parents';
  end if;

  perform set_config('kartos.self_edit', auth.uid()::text, true);
  insert into persons (workspace_id, given_names, surname, birth_year, is_living, sex, created_by)
  values (ws, trim(p_given), nullif(trim(p_surname), ''), p_birth_year, true,
          case when p_sex in ('male', 'female') then p_sex else 'unknown' end, auth.uid())
  returning id into new_id;
  update workspace_members set person_id = new_id where workspace_id = ws and user_id = auth.uid();
  perform set_config('kartos.self_edit', '', true);

  -- The relationship is an addition to the tree like any other.
  if p_kind = 'child' then
    insert into relationships (workspace_id, person_a, person_b, type, subtype) values (ws, p_relative, new_id, 'parent_child', 'biological');
  elsif p_kind = 'parent' then
    insert into relationships (workspace_id, person_a, person_b, type, subtype) values (ws, new_id, p_relative, 'parent_child', 'biological');
  elsif p_kind = 'partner' then
    insert into relationships (workspace_id, person_a, person_b, type, subtype) values (ws, p_relative, new_id, 'partner', 'married');
  else
    for par in select person_a from relationships where workspace_id = ws and type = 'parent_child' and person_b = p_relative and status <> 'rejected' loop
      insert into relationships (workspace_id, person_a, person_b, type, subtype) values (ws, par, new_id, 'parent_child', 'biological');
    end loop;
  end if;
  return new_id;
end $$;

revoke all on function create_my_person_related(uuid, text, text, int, text, text, uuid) from public, anon;
grant execute on function create_my_person_related(uuid, text, text, int, text, text, uuid) to authenticated;
