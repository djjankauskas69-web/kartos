-- Videos in the archive: a new kind of item (the file plays; a still frame sits beside it in storage).
alter table media drop constraint if exists media_kind_check;
alter table media add constraint media_kind_check check (kind in ('photo', 'document', 'story', 'video'));
