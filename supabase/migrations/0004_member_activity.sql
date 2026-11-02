-- Kartos — 0004: when each family member last signed in (members of the same archive only)
create or replace function member_last_seen(ws uuid)
returns table (user_id uuid, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, u.last_sign_in_at
  from workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws and is_member(ws);
$$;

revoke all on function member_last_seen(uuid) from public, anon;
grant execute on function member_last_seen(uuid) to authenticated;
