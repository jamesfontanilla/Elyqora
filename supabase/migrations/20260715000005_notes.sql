create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  body_md text not null default '' check (char_length(body_md) <= 12000),
  checklist_items jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist_items) = 'array'),
  scope text not null default 'personal' check (scope in ('personal', 'workspace')),
  visibility text not null default 'private' check (visibility in ('private', 'workspace')),
  color text not null default 'mint' check (color in ('sand', 'mint', 'coral', 'sky', 'amber', 'plum')),
  pinned boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  revision integer not null default 0 check (revision >= 0),
  search_document tsvector not null default ''::tsvector,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  check (
    (scope = 'personal' and visibility = 'private')
    or (scope = 'workspace' and visibility in ('private', 'workspace'))
  )
);

create table if not exists public.note_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40 and label = lower(label)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (note_id, label)
);

create table if not exists public.note_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  target_type text not null check (target_type in ('project', 'task', 'contact', 'ticket', 'event', 'course')),
  target_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (note_id, target_type, target_id)
);

create table if not exists public.note_reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  remind_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'dismissed', 'triggered')),
  notification_id uuid references public.notifications(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (note_id)
);

create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  file_id uuid not null references public.drive_files(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (note_id, file_id)
);

create index if not exists notes_workspace_updated_idx on public.notes(workspace_id, updated_at desc) where deleted_at is null;
create index if not exists notes_workspace_pinned_idx on public.notes(workspace_id, pinned, updated_at desc) where deleted_at is null and archived_at is null;
create index if not exists notes_workspace_archived_idx on public.notes(workspace_id, archived_at desc) where deleted_at is null and archived_at is not null;
create index if not exists notes_search_idx on public.notes using gin (search_document);
create index if not exists note_labels_workspace_idx on public.note_labels(workspace_id, label, created_at desc);
create index if not exists note_links_workspace_idx on public.note_links(workspace_id, note_id, created_at desc);
create index if not exists note_reminders_workspace_due_idx on public.note_reminders(workspace_id, status, remind_at);
create index if not exists note_attachments_workspace_idx on public.note_attachments(workspace_id, note_id, created_at desc);

alter table public.drive_attachments drop constraint if exists drive_attachments_target_type_check;
alter table public.drive_attachments add constraint drive_attachments_target_type_check check (target_type in ('docs', 'notes', 'expenses', 'projects', 'helpdesk', 'contacts'));

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
  for each row execute procedure public.set_updated_at();
drop trigger if exists note_reminders_set_updated_at on public.note_reminders;
create trigger note_reminders_set_updated_at before update on public.note_reminders
  for each row execute procedure public.set_updated_at();

create or replace function public.validate_note_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label_text text;
  item jsonb;
  item_text text;
  checklist_text text := '';
begin
  if auth.uid() is not null and not public.is_workspace_member(new.workspace_id) then
    raise exception 'Not authorized to change this note';
  end if;
  if auth.uid() is not null and (new.created_by <> auth.uid() or new.updated_by <> auth.uid()) then
    raise exception 'Note ownership does not match the current user';
  end if;
  if new.scope = 'personal' and new.visibility <> 'private' then
    raise exception 'Personal notes must stay private';
  end if;
  if new.scope = 'workspace' and new.visibility not in ('private', 'workspace') then
    raise exception 'Workspace notes need a valid visibility';
  end if;
  if new.checklist_items is null or jsonb_typeof(new.checklist_items) <> 'array' then
    raise exception 'Checklist items must be a JSON array';
  end if;
  for item in select * from jsonb_array_elements(coalesce(new.checklist_items, '[]'::jsonb))
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Checklist items must be objects';
    end if;
    item_text := trim(coalesce(item ->> 'text', ''));
    if char_length(item_text) > 200 then
      raise exception 'Checklist item text is too long';
    end if;
    checklist_text := checklist_text || ' ' || item_text;
  end loop;
  new.search_document := to_tsvector(
    'simple',
    concat_ws(
      ' ',
      coalesce(new.title, ''),
      coalesce(new.body_md, ''),
      checklist_text,
      coalesce((
        select string_agg(label_text.label, ' ')
        from public.note_labels label_text
        where label_text.note_id = new.id
      ), '')
    )
  );
  return new;
end;
$$;

create or replace function public.rebuild_note_search_document(target_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  note_record record;
  label_text text;
  checklist_text text;
begin
  select * into note_record
  from public.notes
  where id = target_note_id;
  if not found then
    return;
  end if;

  select coalesce(string_agg(label, ' '), '') into label_text
  from public.note_labels
  where note_id = target_note_id;

  select coalesce(string_agg(coalesce(item ->> 'text', ''), ' '), '') into checklist_text
  from jsonb_array_elements(coalesce(note_record.checklist_items, '[]'::jsonb)) as item;

  update public.notes
  set search_document = to_tsvector(
    'simple',
    concat_ws(' ', coalesce(note_record.title, ''), coalesce(note_record.body_md, ''), coalesce(label_text, ''), coalesce(checklist_text, ''))
  )
  where id = target_note_id;
end;
$$;

create or replace function public.sync_note_label_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_note_search_document(old.note_id);
    return old;
  end if;
  perform public.rebuild_note_search_document(new.note_id);
  return new;
end;
$$;

create or replace function public.sync_note_reminder_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  note_title text;
  notification_title text;
  notification_body text;
  notification_href text;
begin
  if tg_op = 'DELETE' then
    if old.notification_id is not null then
      delete from public.notifications where id = old.notification_id;
    end if;
    return old;
  end if;

  select title into note_title from public.notes where id = new.note_id;
  notification_title := format('Reminder: %s', coalesce(note_title, 'Note'));
  notification_body := format('Due %s', to_char(new.remind_at, 'Mon DD, YYYY HH24:MI'));
  notification_href := '/notes/' || new.note_id::text;

  if new.status = 'dismissed' then
    if new.notification_id is not null then
      delete from public.notifications where id = new.notification_id;
    end if;
    new.notification_id := null;
    return new;
  end if;

  if new.notification_id is null then
    insert into public.notifications (workspace_id, user_id, title, body, kind, href)
    values (new.workspace_id, new.created_by, notification_title, notification_body, 'warning', notification_href)
    returning id into new.notification_id;
  else
    update public.notifications
    set title = notification_title,
        body = notification_body,
        kind = 'warning',
        href = notification_href,
        read_at = null
    where id = new.notification_id
      and user_id = new.created_by;
  end if;
  return new;
end;
$$;

create or replace function public.sync_note_attachment_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.note_attachments where workspace_id = old.workspace_id and note_id = old.target_id and file_id = old.file_id;
    return old;
  end if;

  if new.target_type = 'notes' then
    insert into public.note_attachments (workspace_id, note_id, file_id, created_by)
    values (new.workspace_id, new.target_id, new.file_id, new.created_by)
    on conflict (note_id, file_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_validate_record on public.notes;
create trigger notes_validate_record before insert or update on public.notes
  for each row execute procedure public.validate_note_record();
drop trigger if exists note_labels_sync_search on public.note_labels;
create trigger note_labels_sync_search after insert or update or delete on public.note_labels
  for each row execute procedure public.sync_note_label_search();
drop trigger if exists note_reminders_sync_notification on public.note_reminders;
create trigger note_reminders_sync_notification before insert or update on public.note_reminders
  for each row execute procedure public.sync_note_reminder_notification();
drop trigger if exists note_reminders_delete_notification on public.note_reminders;
create trigger note_reminders_delete_notification after delete on public.note_reminders
  for each row execute procedure public.sync_note_reminder_notification();
drop trigger if exists drive_attachments_sync_notes on public.drive_attachments;
drop trigger if exists drive_attachments_sync_notes_insert on public.drive_attachments;
create trigger drive_attachments_sync_notes_insert after insert on public.drive_attachments
  for each row when (new.target_type = 'notes')
  execute procedure public.sync_note_attachment_record();
drop trigger if exists drive_attachments_sync_notes_delete on public.drive_attachments;
create trigger drive_attachments_sync_notes_delete after delete on public.drive_attachments
  for each row when (old.target_type = 'notes')
  execute procedure public.sync_note_attachment_record();

create or replace function public.can_read_note(target_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notes note_record
    where note_record.id = target_note_id
      and public.is_workspace_member(note_record.workspace_id)
      and (
        (note_record.deleted_at is null and note_record.scope = 'personal' and note_record.created_by = auth.uid())
        or
        (note_record.deleted_at is null and note_record.scope = 'workspace' and note_record.visibility = 'workspace' and public.has_workspace_permission(note_record.workspace_id, 'notes.read'))
        or
        (note_record.deleted_at is null and note_record.scope = 'workspace' and note_record.visibility = 'private' and (note_record.created_by = auth.uid() or public.has_workspace_permission(note_record.workspace_id, 'notes.manage')))
        or
        (note_record.deleted_at is not null and (note_record.created_by = auth.uid() or public.has_workspace_permission(note_record.workspace_id, 'notes.manage')))
      )
  );
$$;

create or replace function public.can_edit_note(target_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notes note_record
    where note_record.id = target_note_id
      and note_record.deleted_at is null
      and public.is_workspace_member(note_record.workspace_id)
      and (
        (note_record.scope = 'personal' and note_record.created_by = auth.uid())
        or
        (note_record.scope = 'workspace' and note_record.visibility = 'workspace' and public.has_workspace_permission(note_record.workspace_id, 'notes.write'))
        or
        (note_record.scope = 'workspace' and note_record.visibility = 'private' and (note_record.created_by = auth.uid() or public.has_workspace_permission(note_record.workspace_id, 'notes.manage')))
      )
  );
$$;

create or replace function public.can_manage_note(target_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notes note_record
    where note_record.id = target_note_id
      and public.is_workspace_member(note_record.workspace_id)
      and (
        (note_record.scope = 'personal' and note_record.created_by = auth.uid())
        or
        (note_record.scope = 'workspace' and public.has_workspace_permission(note_record.workspace_id, 'notes.manage'))
      )
  );
$$;

create or replace function public.seed_notes_for_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  personal_note_id uuid;
  workspace_note_id uuid;
begin
  select id into personal_note_id
  from public.notes
  where workspace_id = new.id
    and scope = 'personal'
    and title = 'Private scratchpad'
    and deleted_at is null
  limit 1;

  if personal_note_id is null then
  insert into public.notes (workspace_id, title, body_md, checklist_items, scope, visibility, color, pinned, created_by, updated_by)
  values (
    new.id,
    'Private scratchpad',
    E'This note stays private to the workspace owner.\n\n- Quick ideas\n- Personal follow-up\n',
    '[]'::jsonb,
    'personal',
    'private',
    'sand',
    false,
    new.owner_id,
    new.owner_id
  )
  returning id into personal_note_id;
  end if;

  select id into workspace_note_id
  from public.notes
  where workspace_id = new.id
    and scope = 'workspace'
    and title = 'Workspace capture'
    and deleted_at is null
  limit 1;

  if workspace_note_id is null then
  insert into public.notes (workspace_id, title, body_md, checklist_items, scope, visibility, color, pinned, created_by, updated_by)
  values (
    new.id,
    'Workspace capture',
    E'Use this shared note for fast capture, reminders, and loose follow-ups.',
    jsonb_build_array(jsonb_build_object('id', 'welcome-1', 'text', 'Review open setup tasks', 'checked', false)),
    'workspace',
    'workspace',
    'mint',
    true,
    new.owner_id,
    new.owner_id
  )
  returning id into workspace_note_id;
  end if;

  if workspace_note_id is not null then
    insert into public.note_labels (workspace_id, note_id, label, created_by)
    values (new.id, workspace_note_id, 'launch', new.owner_id)
    on conflict (note_id, label) do nothing;

    insert into public.note_reminders (workspace_id, note_id, remind_at, status, created_by, updated_by)
    values (new.id, workspace_note_id, now() + interval '3 days', 'scheduled', new.owner_id, new.owner_id)
    on conflict (note_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists workspaces_seed_notes on public.workspaces;
create trigger workspaces_seed_notes after insert on public.workspaces
  for each row execute procedure public.seed_notes_for_workspace();

insert into public.permissions (key, label, description)
values
  ('notes.read', 'Read Notes', 'View accessible personal and workspace notes.'),
  ('notes.write', 'Write Notes', 'Create and update notes, labels, reminders, links, and attachments.'),
  ('notes.manage', 'Manage Notes', 'Archive, delete, restore, and manage note visibility.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.key in ('notes.read', 'notes.write', 'notes.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'member'
  and p.key in ('notes.read', 'notes.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'viewer'
  and p.key = 'notes.read'
on conflict do nothing;

alter table public.notes enable row level security;
alter table public.note_labels enable row level security;
alter table public.note_links enable row level security;
alter table public.note_reminders enable row level security;
alter table public.note_attachments enable row level security;

drop policy if exists notes_member_read on public.notes;
create policy notes_member_read on public.notes for select using (
  public.can_read_note(id)
);
drop policy if exists notes_writer_insert on public.notes;
create policy notes_writer_insert on public.notes for insert with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and public.is_workspace_member(workspace_id)
  and (
    (scope = 'personal')
    or (scope = 'workspace' and public.has_workspace_permission(workspace_id, 'notes.write'))
  )
);
drop policy if exists notes_writer_update on public.notes;
create policy notes_writer_update on public.notes for update using (
  public.can_edit_note(id)
) with check (
  public.can_edit_note(id)
);
drop policy if exists notes_manager_delete on public.notes;
create policy notes_manager_delete on public.notes for delete using (
  public.can_manage_note(id)
);

drop policy if exists note_labels_member_read on public.note_labels;
create policy note_labels_member_read on public.note_labels for select using (public.can_read_note(note_id));
drop policy if exists note_labels_writer_insert on public.note_labels;
create policy note_labels_writer_insert on public.note_labels for insert with check (created_by = auth.uid() and public.can_edit_note(note_id));
drop policy if exists note_labels_writer_update on public.note_labels;
create policy note_labels_writer_update on public.note_labels for update using (public.can_edit_note(note_id)) with check (public.can_edit_note(note_id));
drop policy if exists note_labels_writer_delete on public.note_labels;
create policy note_labels_writer_delete on public.note_labels for delete using (public.can_edit_note(note_id));

drop policy if exists note_links_member_read on public.note_links;
create policy note_links_member_read on public.note_links for select using (public.can_read_note(note_id));
drop policy if exists note_links_writer_insert on public.note_links;
create policy note_links_writer_insert on public.note_links for insert with check (created_by = auth.uid() and public.can_edit_note(note_id));
drop policy if exists note_links_writer_delete on public.note_links;
create policy note_links_writer_delete on public.note_links for delete using (public.can_edit_note(note_id));

drop policy if exists note_reminders_member_read on public.note_reminders;
create policy note_reminders_member_read on public.note_reminders for select using (public.can_read_note(note_id));
drop policy if exists note_reminders_writer_insert on public.note_reminders;
create policy note_reminders_writer_insert on public.note_reminders for insert with check (created_by = auth.uid() and updated_by = auth.uid() and public.can_edit_note(note_id));
drop policy if exists note_reminders_writer_update on public.note_reminders;
create policy note_reminders_writer_update on public.note_reminders for update using (public.can_edit_note(note_id)) with check (public.can_edit_note(note_id));
drop policy if exists note_reminders_writer_delete on public.note_reminders;
create policy note_reminders_writer_delete on public.note_reminders for delete using (public.can_edit_note(note_id));

drop policy if exists note_attachments_member_read on public.note_attachments;
create policy note_attachments_member_read on public.note_attachments for select using (public.can_read_note(note_id));
drop policy if exists note_attachments_writer_insert on public.note_attachments;
create policy note_attachments_writer_insert on public.note_attachments for insert with check (created_by = auth.uid() and public.can_edit_note(note_id));
drop policy if exists note_attachments_writer_delete on public.note_attachments;
create policy note_attachments_writer_delete on public.note_attachments for delete using (public.can_edit_note(note_id));

grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_labels to authenticated;
grant select, insert, delete on public.note_links to authenticated;
grant select, insert, update, delete on public.note_reminders to authenticated;
grant select, insert, delete on public.note_attachments to authenticated;
grant execute on function public.can_read_note(uuid) to authenticated;
grant execute on function public.can_edit_note(uuid) to authenticated;
grant execute on function public.can_manage_note(uuid) to authenticated;
