-- After two families have linked their trees, an administrator comparing them can mark more
-- people as "the same person" (and the people they copy over from the other tree).
-- Allowed only between archives that already have an accepted link, for the administrator of
-- this archive who is also a member of the other one.

create or replace function link_people(p_mine uuid, p_theirs uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ws_a uuid := person_workspace(p_mine);
  ws_b uuid := person_workspace(p_theirs);
  new_id uuid;
begin
  if ws_a is null or ws_b is null or ws_a = ws_b then
    raise exception 'Pick people from two archives';
  end if;
  if not has_role(ws_a, '{owner}') or not is_member(ws_b) then
    raise exception 'Only the administrator who can see both trees can do this';
  end if;
  if not exists (
    select 1 from family_links
    where accepted_at is not null
      and ((a_workspace = ws_a and b_workspace = ws_b) or (a_workspace = ws_b and b_workspace = ws_a))
  ) then
    raise exception 'Link the two family trees first';
  end if;
  if exists (
    select 1 from family_links
    where (a_person = p_mine and b_person = p_theirs) or (a_person = p_theirs and b_person = p_mine)
  ) then
    return null;
  end if;
  insert into family_links (a_workspace, a_person, b_workspace, b_person, accepted_by, accepted_at)
  values (ws_a, p_mine, ws_b, p_theirs, auth.uid(), now())
  returning id into new_id;
  return new_id;
end $$;

revoke all on function link_people(uuid, uuid) from public, anon;
grant execute on function link_people(uuid, uuid) to authenticated;
