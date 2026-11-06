-- Kartos — 0019: a memory can be corrected by its author and be about more than one person.

-- Other people a memory is about (the main one stays memories.person_id).
create table if not exists memory_persons (
  memory_id uuid not null references memories on delete cascade,
  person_id uuid not null references persons on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  primary key (memory_id, person_id)
);
create index if not exists memory_persons_person on memory_persons (person_id);
alter table memory_persons enable row level security;
drop policy if exists "members read memory people" on memory_persons;
create policy "members read memory people" on memory_persons for select using (is_member(workspace_id));
drop policy if exists "author or editors tag memory people" on memory_persons;
create policy "author or editors tag memory people" on memory_persons for all
  using (has_role(workspace_id, '{owner,editor}') or exists (select 1 from memories m where m.id = memory_id and m.author_id = auth.uid()))
  with check (has_role(workspace_id, '{owner,editor}') or exists (select 1 from memories m where m.id = memory_id and m.author_id = auth.uid()));
grant select, insert, delete on memory_persons to authenticated;

-- The author (or an editor) corrects the text; nothing else about the memory changes.
create or replace function edit_memory(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m memories;
begin
  select * into m from memories where id = p_id;
  if m.id is null then raise exception 'memory not found'; end if;
  if not (m.author_id = auth.uid() or has_role(m.workspace_id, '{owner,editor}')) then
    raise exception 'not allowed';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'empty'; end if;
  update memories set body = left(trim(p_body), 20000) where id = p_id;
end $$;
grant execute on function edit_memory(uuid, text) to authenticated;
