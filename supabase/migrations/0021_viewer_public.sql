-- Kartos — 0021: "View only" sees what the family marked "Everyone" (shared), like a share link.
-- Memories and archive photos marked "Only the family" are for members who add or edit.
-- Portraits and the family's cover stay visible, so the tree doesn't look empty.

drop policy if exists "members read media" on media;
create policy "members read media" on media for select using (
  is_member(workspace_id)
  and (status = 'approved' or uploader_id = auth.uid() or has_role(workspace_id, '{owner}'))
  and (shared or storage_path like '%/portraits/%' or not has_role(workspace_id, '{viewer}'))
);

drop policy if exists "members read memories" on memories;
create policy "members read memories" on memories for select using (
  is_member(workspace_id)
  and (status = 'approved' or author_id = auth.uid() or has_role(workspace_id, '{owner}'))
  and (shared or not has_role(workspace_id, '{viewer}'))
);

drop policy if exists "members read family files" on storage.objects;
create policy "members read family files" on storage.objects for select using (
  bucket_id = 'family-media'
  and is_member(((storage.foldername(name))[1])::uuid)
  and (
    not has_role(((storage.foldername(name))[1])::uuid, '{viewer}')
    or name like '%/portraits/%'
    or exists (select 1 from workspaces w where w.cover_path = name)
    or exists (select 1 from media m where m.storage_path = name and m.shared)
  )
);
