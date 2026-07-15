create table if not exists public.drive_storage_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  max_file_size_bytes bigint not null default 10485760 check (max_file_size_bytes between 1 and 10485760),
  quota_bytes bigint not null default 104857600 check (quota_bytes between 1048576 and 1073741824),
  allowed_mime_types text[] not null default array[
    'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  ]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(allowed_mime_types) > 0),
  check (allowed_mime_types <@ array[
    'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  ]::text[])
);

create table if not exists public.drive_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.drive_folders(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and name !~ '[\\\\/]'),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, parent_id, name)
);

create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.drive_folders(id) on delete set null,
  name text not null check (char_length(name) between 1 and 160 and name !~ '[\\\\/]'),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'ready', 'failed')),
  access_level text not null default 'workspace' check (access_level in ('workspace', 'restricted')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.drive_file_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  file_id uuid not null references public.drive_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'read' check (permission in ('read', 'edit')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (file_id, user_id)
);

create table if not exists public.drive_favorites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  file_id uuid not null references public.drive_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (file_id, user_id)
);

create table if not exists public.drive_file_access_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  file_id uuid not null references public.drive_files(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('upload', 'preview', 'download', 'share', 'rename', 'move', 'favorite', 'unfavorite', 'delete', 'restore', 'purge', 'attach', 'detach')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.drive_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  file_id uuid not null references public.drive_files(id) on delete cascade,
  target_type text not null check (target_type in ('docs', 'expenses', 'projects', 'helpdesk', 'contacts')),
  target_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (file_id, target_type, target_id)
);

create index if not exists drive_folders_workspace_parent_idx on public.drive_folders(workspace_id, parent_id, name) where deleted_at is null;
create index if not exists drive_files_workspace_folder_idx on public.drive_files(workspace_id, folder_id, name) where deleted_at is null and upload_status = 'ready';
create index if not exists drive_files_workspace_deleted_idx on public.drive_files(workspace_id, deleted_at, updated_at desc);
create index if not exists drive_files_name_search_idx on public.drive_files using gin (to_tsvector('simple', name));
create index if not exists drive_shares_file_user_idx on public.drive_file_shares(file_id, user_id);
create index if not exists drive_favorites_user_workspace_idx on public.drive_favorites(user_id, workspace_id, created_at desc);
create index if not exists drive_access_file_created_idx on public.drive_file_access_records(file_id, created_at desc);
create index if not exists drive_attachments_target_idx on public.drive_attachments(workspace_id, target_type, target_id);

drop trigger if exists drive_storage_settings_set_updated_at on public.drive_storage_settings;
create trigger drive_storage_settings_set_updated_at before update on public.drive_storage_settings
  for each row execute procedure public.set_updated_at();
drop trigger if exists drive_folders_set_updated_at on public.drive_folders;
create trigger drive_folders_set_updated_at before update on public.drive_folders
  for each row execute procedure public.set_updated_at();
drop trigger if exists drive_files_set_updated_at on public.drive_files;
create trigger drive_files_set_updated_at before update on public.drive_files
  for each row execute procedure public.set_updated_at();
drop trigger if exists drive_file_shares_set_updated_at on public.drive_file_shares;
create trigger drive_file_shares_set_updated_at before update on public.drive_file_shares
  for each row execute procedure public.set_updated_at();

create or replace function public.can_read_drive_file(target_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drive_files file_record
    where file_record.id = target_file_id
      and file_record.deleted_at is null
      and file_record.upload_status = 'ready'
      and public.is_workspace_member(file_record.workspace_id)
      and (
        file_record.access_level = 'workspace'
        or file_record.created_by = auth.uid()
        or exists (
          select 1
          from public.drive_file_shares share_record
          where share_record.file_id = file_record.id
            and share_record.user_id = auth.uid()
            and share_record.permission in ('read', 'edit')
        )
      )
  );
$$;

create or replace function public.can_edit_drive_file(target_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drive_files file_record
    where file_record.id = target_file_id
      and public.is_workspace_member(file_record.workspace_id)
      and (
        file_record.created_by = auth.uid()
        or public.has_workspace_permission(file_record.workspace_id, 'drive.manage')
        or exists (
          select 1
          from public.drive_file_shares share_record
          where share_record.file_id = file_record.id
            and share_record.user_id = auth.uid()
            and share_record.permission = 'edit'
        )
      )
  );
$$;

create or replace function public.get_drive_storage_usage(target_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(file_record.size_bytes), 0)::bigint
  from public.drive_files file_record
  where file_record.workspace_id = target_workspace_id
    and file_record.upload_status = 'ready'
    and file_record.deleted_at is null
    and public.is_workspace_member(target_workspace_id);
$$;

create or replace function public.can_upload_drive_object(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drive_files file_record
    where file_record.storage_path = target_storage_path
      and file_record.created_by = auth.uid()
      and file_record.upload_status = 'pending'
      and public.is_workspace_member(file_record.workspace_id)
  );
$$;

create or replace function public.seed_drive_for_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.drive_storage_settings (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_seed_drive on public.workspaces;
create trigger workspaces_seed_drive after insert on public.workspaces
  for each row execute procedure public.seed_drive_for_workspace();

insert into public.permissions (key, label, description)
values
  ('drive.read', 'Read Drive Lite', 'View permitted workspace files and folders.'),
  ('drive.write', 'Write Drive Lite', 'Upload and organize workspace files.'),
  ('drive.manage', 'Manage Drive Lite', 'Manage restricted files, folders, and storage settings.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where permissions.key in ('drive.read', 'drive.write', 'drive.manage')
  and roles.name in ('owner', 'admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where permissions.key in ('drive.read', 'drive.write')
  and roles.name = 'member'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where permissions.key = 'drive.read'
  and roles.name = 'viewer'
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'elyqora-drive',
  'elyqora-drive',
  false,
  10485760,
  array[
    'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.drive_storage_settings enable row level security;
alter table public.drive_folders enable row level security;
alter table public.drive_files enable row level security;
alter table public.drive_file_shares enable row level security;
alter table public.drive_favorites enable row level security;
alter table public.drive_file_access_records enable row level security;
alter table public.drive_attachments enable row level security;

drop policy if exists drive_settings_member_read on public.drive_storage_settings;
create policy drive_settings_member_read on public.drive_storage_settings for select using (public.is_workspace_member(workspace_id));
drop policy if exists drive_settings_manager_insert on public.drive_storage_settings;
create policy drive_settings_manager_insert on public.drive_storage_settings for insert with check (public.has_workspace_permission(workspace_id, 'workspace.update'));
drop policy if exists drive_settings_manager_update on public.drive_storage_settings;
create policy drive_settings_manager_update on public.drive_storage_settings for update using (public.has_workspace_permission(workspace_id, 'workspace.update')) with check (public.has_workspace_permission(workspace_id, 'workspace.update'));

drop policy if exists drive_folders_member_read on public.drive_folders;
create policy drive_folders_member_read on public.drive_folders for select using (deleted_at is null and public.is_workspace_member(workspace_id));
drop policy if exists drive_folders_member_insert on public.drive_folders;
create policy drive_folders_member_insert on public.drive_folders for insert with check (created_by = auth.uid() and updated_by = auth.uid() and public.has_workspace_permission(workspace_id, 'drive.write'));
drop policy if exists drive_folders_writer_update on public.drive_folders;
create policy drive_folders_writer_update on public.drive_folders for update using (created_by = auth.uid() or public.has_workspace_permission(workspace_id, 'drive.manage')) with check (public.is_workspace_member(workspace_id));
drop policy if exists drive_folders_manager_delete on public.drive_folders;
create policy drive_folders_manager_delete on public.drive_folders for delete using (public.has_workspace_permission(workspace_id, 'drive.manage'));

drop policy if exists drive_files_member_read on public.drive_files;
create policy drive_files_member_read on public.drive_files for select using (
  (deleted_at is null and public.can_read_drive_file(id))
  or (deleted_at is not null and (created_by = auth.uid() or public.has_workspace_permission(workspace_id, 'drive.manage')))
);
drop policy if exists drive_files_writer_insert on public.drive_files;
create policy drive_files_writer_insert on public.drive_files for insert with check (
  created_by = auth.uid() and updated_by = auth.uid() and public.has_workspace_permission(workspace_id, 'drive.write')
);
drop policy if exists drive_files_editor_update on public.drive_files;
create policy drive_files_editor_update on public.drive_files for update using (public.can_edit_drive_file(id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists drive_files_editor_delete on public.drive_files;
create policy drive_files_editor_delete on public.drive_files for delete using (public.can_edit_drive_file(id));

drop policy if exists drive_shares_member_read on public.drive_file_shares;
create policy drive_shares_member_read on public.drive_file_shares for select using (
  public.can_read_drive_file(file_id) or public.can_edit_drive_file(file_id)
);
drop policy if exists drive_shares_editor_insert on public.drive_file_shares;
create policy drive_shares_editor_insert on public.drive_file_shares for insert with check (
  created_by = auth.uid()
  and public.can_edit_drive_file(file_id)
  and exists (select 1 from public.memberships member_record where member_record.workspace_id = workspace_id and member_record.user_id = user_id and member_record.status = 'active')
);
drop policy if exists drive_shares_editor_update on public.drive_file_shares;
create policy drive_shares_editor_update on public.drive_file_shares for update using (public.can_edit_drive_file(file_id)) with check (public.can_edit_drive_file(file_id));
drop policy if exists drive_shares_editor_delete on public.drive_file_shares;
create policy drive_shares_editor_delete on public.drive_file_shares for delete using (public.can_edit_drive_file(file_id));

drop policy if exists drive_favorites_owner_read on public.drive_favorites;
create policy drive_favorites_owner_read on public.drive_favorites for select using (user_id = auth.uid() and public.can_read_drive_file(file_id));
drop policy if exists drive_favorites_owner_insert on public.drive_favorites;
create policy drive_favorites_owner_insert on public.drive_favorites for insert with check (user_id = auth.uid() and public.can_read_drive_file(file_id));
drop policy if exists drive_favorites_owner_delete on public.drive_favorites;
create policy drive_favorites_owner_delete on public.drive_favorites for delete using (user_id = auth.uid());

drop policy if exists drive_access_owner_read on public.drive_file_access_records;
create policy drive_access_owner_read on public.drive_file_access_records for select using (
  (actor_id = auth.uid() and public.is_workspace_member(workspace_id))
  or public.has_workspace_permission(workspace_id, 'audit.read')
);
drop policy if exists drive_access_owner_insert on public.drive_file_access_records;
create policy drive_access_owner_insert on public.drive_file_access_records for insert with check (actor_id = auth.uid() and (public.can_read_drive_file(file_id) or public.can_edit_drive_file(file_id)));

drop policy if exists drive_attachments_member_read on public.drive_attachments;
create policy drive_attachments_member_read on public.drive_attachments for select using (public.can_read_drive_file(file_id));
drop policy if exists drive_attachments_editor_insert on public.drive_attachments;
create policy drive_attachments_editor_insert on public.drive_attachments for insert with check (created_by = auth.uid() and public.can_edit_drive_file(file_id));
drop policy if exists drive_attachments_editor_delete on public.drive_attachments;
create policy drive_attachments_editor_delete on public.drive_attachments for delete using (public.can_edit_drive_file(file_id));

drop policy if exists drive_storage_insert on storage.objects;
create policy drive_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'elyqora-drive'
  and public.can_upload_drive_object(name)
);
drop policy if exists drive_storage_select on storage.objects;
create policy drive_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'elyqora-drive'
  and exists (select 1 from public.drive_files file_record where file_record.storage_path = name and public.can_read_drive_file(file_record.id))
);
drop policy if exists drive_storage_update on storage.objects;
create policy drive_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'elyqora-drive'
  and exists (select 1 from public.drive_files file_record where file_record.storage_path = name and public.can_edit_drive_file(file_record.id))
);
drop policy if exists drive_storage_delete on storage.objects;
create policy drive_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'elyqora-drive'
  and exists (select 1 from public.drive_files file_record where file_record.storage_path = name and public.can_edit_drive_file(file_record.id))
);

grant select, insert, update on public.drive_storage_settings to authenticated;
grant select, insert, update, delete on public.drive_folders to authenticated;
grant select, insert, update, delete on public.drive_files to authenticated;
grant select, insert, update, delete on public.drive_file_shares to authenticated;
grant select, insert, delete on public.drive_favorites to authenticated;
grant select, insert on public.drive_file_access_records to authenticated;
grant select, insert, delete on public.drive_attachments to authenticated;
grant execute on function public.can_read_drive_file(uuid) to authenticated;
grant execute on function public.can_edit_drive_file(uuid) to authenticated;
grant execute on function public.get_drive_storage_usage(uuid) to authenticated;
grant execute on function public.can_upload_drive_object(text) to authenticated;
