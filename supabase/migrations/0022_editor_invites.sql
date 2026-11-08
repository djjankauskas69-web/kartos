-- Editors may invite people too, but only as a member (contributor) or a viewer.
-- They see and revoke only the invitations they created; the administrator manages all.
create policy "editor sees own invitations" on invitations for select
  using (has_role(workspace_id, '{editor}') and invited_by = auth.uid());
create policy "editor invites contributors and viewers" on invitations for insert
  with check (has_role(workspace_id, '{editor}') and invited_by = auth.uid() and role in ('contributor', 'viewer'));
create policy "editor revokes own invitations" on invitations for update
  using (has_role(workspace_id, '{editor}') and invited_by = auth.uid())
  with check (has_role(workspace_id, '{editor}') and invited_by = auth.uid() and role in ('contributor', 'viewer'));
