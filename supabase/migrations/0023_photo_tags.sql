-- Where each person is on a photo (0–1 from the left and from the top); empty = only linked.
alter table media_persons add column if not exists x real, add column if not exists y real;
drop policy if exists "members place tags" on media_persons;
create policy "members place tags" on media_persons for update
  using (has_role(workspace_id, '{owner,editor,contributor}'))
  with check (has_role(workspace_id, '{owner,editor,contributor}'));
