-- Kartos — 0012: sharing a person's memories and photos with the family they are linked to.
-- Each family keeps its own record of the person; a family link (or the same member being
-- "this is me" in both archives) says the two records are one person. Memories and photos are
-- private to their own archive unless marked shared; shared ones can also be seen by the
-- members of the linked family, on their record of that person.

alter table memories add column if not exists shared boolean not null default false;
alter table media add column if not exists shared boolean not null default false;

-- Can the signed-in user see what is shared about person p (who belongs to another archive)?
create or replace function sees_shared(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_links fl
    where fl.accepted_at is not null
      and ((fl.a_person = p and fl.b_workspace is not null and is_member(fl.b_workspace))
        or (fl.b_person = p and is_member(fl.a_workspace)))
  ) or exists (
    -- the same member is "this is me" for p and for someone in an archive the user is in
    select 1
    from workspace_members wa
    join workspace_members wb on wb.user_id = wa.user_id and wb.workspace_id <> wa.workspace_id and wb.person_id is not null
    where wa.person_id = p and is_member(wb.workspace_id)
  );
$$;

-- A photo or document is visible through sharing when it is shared and shows a shared person.
create or replace function media_shared_visible(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from media x join media_persons mp on mp.media_id = x.id
    where x.id = m and x.shared and x.status = 'approved' and x.deleted_at is null and sees_shared(mp.person_id)
  ) or exists (
    select 1 from memories me join media x on x.id = me.media_id
    where me.media_id = m and x.deleted_at is null and me.shared and me.status = 'approved' and sees_shared(me.person_id)
  );
$$;

-- The stored file behind shared media (for the signed link).
create or replace function shared_file(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from media x where x.storage_path = path and media_shared_visible(x.id));
$$;

drop policy if exists "read shared memories" on memories;
create policy "read shared memories" on memories for select
  using (shared and status = 'approved' and sees_shared(person_id));

drop policy if exists "read shared media" on media;
create policy "read shared media" on media for select
  using (media_shared_visible(id));

-- Which person a shared photo shows (so the linked family can find it on their record).
drop policy if exists "read shared tags" on media_persons;
create policy "read shared tags" on media_persons for select
  using (sees_shared(person_id) and media_shared_visible(media_id));

drop policy if exists "read shared family files" on storage.objects;
create policy "read shared family files" on storage.objects for select
  using (bucket_id = 'family-media' and shared_file(name));

-- The linked family's facts about the same person (name, years, places) — to show where the
-- two records differ. Only for a person in an archive the user belongs to.
create or replace function linked_facts(mine uuid)
returns table (workspace_name text, given_names text, surname text, birth_year int, death_year int, birth_place text, death_place text)
language sql stable security definer set search_path = public as $$
  with me as (select workspace_id from persons where id = mine and deleted_at is null and is_member(workspace_id)),
  others as (
    select case when fl.a_person = mine then fl.b_person else fl.a_person end as person
    from family_links fl, me
    where fl.accepted_at is not null and (fl.a_person = mine or fl.b_person = mine)
    union
    select wb.person_id
    from me
    join workspace_members wa on wa.workspace_id = me.workspace_id and wa.person_id = mine
    join workspace_members wb on wb.user_id = wa.user_id and wb.workspace_id <> wa.workspace_id and wb.person_id is not null
  )
  select w.name, p.given_names, p.surname, p.birth_year, p.death_year, p.birth_place, p.death_place
  from others o join persons p on p.id = o.person and p.deleted_at is null
  join workspaces w on w.id = p.workspace_id
  where exists (select 1 from me);
$$;

-- The same, as ids: which records elsewhere are this person (to read what they share).
create or replace function linked_people(mine uuid) returns table (person uuid, workspace_name text)
language sql stable security definer set search_path = public as $$
  with me as (select workspace_id from persons where id = mine and deleted_at is null and is_member(workspace_id)),
  others as (
    select case when fl.a_person = mine then fl.b_person else fl.a_person end as person
    from family_links fl, me
    where fl.accepted_at is not null and (fl.a_person = mine or fl.b_person = mine)
    union
    select wb.person_id
    from me
    join workspace_members wa on wa.workspace_id = me.workspace_id and wa.person_id = mine
    join workspace_members wb on wb.user_id = wa.user_id and wb.workspace_id <> wa.workspace_id and wb.person_id is not null
  )
  select o.person, w.name from others o join persons p on p.id = o.person and p.deleted_at is null join workspaces w on w.id = p.workspace_id
  where exists (select 1 from me);
$$;

grant execute on function sees_shared(uuid), media_shared_visible(uuid), shared_file(text), linked_facts(uuid), linked_people(uuid) to authenticated;
