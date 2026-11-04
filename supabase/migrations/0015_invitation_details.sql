-- Kartos — 0015: an invitation page shows whom it is for (the person in the tree) and,
-- for the one who invited, the name they have in the tree rather than an email.
create or replace function invitation_details(p_token text)
returns table (person_name text, inviter_name text)
language sql stable security definer set search_path = public as $$
  select
    nullif(concat_ws(' ', ip.given_names, ip.surname), ''),
    coalesce(nullif(concat_ws(' ', bp.given_names, bp.surname), ''), nullif(pr.display_name, ''), '')
  from invitations i
  left join persons ip on ip.id = i.person_id and ip.deleted_at is null
  left join workspace_members wm on wm.workspace_id = i.workspace_id and wm.user_id = i.invited_by
  left join persons bp on bp.id = wm.person_id and bp.deleted_at is null
  left join profiles pr on pr.id = i.invited_by
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and i.revoked_at is null and i.expires_at > now();
$$;
grant execute on function invitation_details(text) to anon, authenticated;
