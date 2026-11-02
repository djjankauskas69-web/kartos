-- Kartos — 0006: "what they were like" — short answers to guided questions about a person.
-- Keys: work, loved, character, saying, legacy. Same read/edit rules as the person.
alter table persons add column if not exists story jsonb not null default '{}'::jsonb;
