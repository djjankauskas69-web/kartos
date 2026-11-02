-- Kartos — 0011: life events and places on a person's profile.
-- kind 'event'      — "1944 served in the army" (place and map point optional)
-- kind 'birthplace' — where they were born, as a point on the map
-- kind 'residence'  — where they lived
create table if not exists person_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  person_id uuid not null references persons on delete cascade,
  kind text not null default 'event' check (kind in ('event', 'birthplace', 'residence')),
  year int,
  year_to int,
  title text,
  place text,
  lat double precision,
  lng double precision,
  status content_status not null default 'approved',
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists person_events_person on person_events (person_id);

alter table person_events enable row level security;
drop policy if exists "members read events" on person_events;
create policy "members read events" on person_events for select using (
  is_member(workspace_id) and (status = 'approved' or created_by = auth.uid() or has_role(workspace_id, '{owner}'))
);
drop policy if exists "contributors add events" on person_events;
create policy "contributors add events" on person_events for insert
  with check (has_role(workspace_id, '{owner,editor,contributor}') and created_by = auth.uid());
drop policy if exists "editors change events" on person_events;
create policy "editors change events" on person_events for update using (has_role(workspace_id, '{owner,editor}'));
drop policy if exists "editors or authors delete events" on person_events;
create policy "editors or authors delete events" on person_events for delete
  using (has_role(workspace_id, '{owner,editor}') or created_by = auth.uid());

drop trigger if exists person_events_initial_status on person_events;
create trigger person_events_initial_status before insert on person_events for each row execute function set_initial_status();
drop trigger if exists person_events_guard_status on person_events;
create trigger person_events_guard_status before update on person_events for each row execute function guard_status();
