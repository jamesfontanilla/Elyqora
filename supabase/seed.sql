insert into public.membership_statuses (key, label, description, is_terminal)
values
  ('invited', 'Invited', 'The user has an invitation but has not joined yet.', false),
  ('active', 'Active', 'The user can access the workspace.', false),
  ('suspended', 'Suspended', 'The user is temporarily blocked from workspace access.', false),
  ('removed', 'Removed', 'The membership is no longer active.', true)
on conflict (key) do update set label = excluded.label, description = excluded.description, is_terminal = excluded.is_terminal;

insert into public.roles (name, label, description)
values
  ('owner', 'Owner', 'Full control of the workspace, members, permissions, and deletion.'),
  ('admin', 'Admin', 'Can manage workspace settings and members, but cannot delete the workspace.'),
  ('member', 'Member', 'Can use enabled Elyqora modules and participate in workspace work.'),
  ('viewer', 'Viewer', 'Can view enabled Elyqora modules without making changes.')
on conflict (name) do update set label = excluded.label, description = excluded.description;

insert into public.permissions (key, label, description)
values
  ('workspace.read', 'View workspace', 'Read workspace details.'),
  ('workspace.update', 'Update workspace', 'Rename or update workspace settings.'),
  ('workspace.delete', 'Delete workspace', 'Soft-delete a workspace.'),
  ('members.read', 'View members', 'Read workspace membership details.'),
  ('members.manage', 'Manage members', 'Invite, change roles, and remove members.'),
  ('audit.read', 'View audit log', 'Read workspace audit events.'),
  ('modules.read', 'Use modules', 'Access enabled Elyqora modules.'),
  ('profile.update', 'Update profile', 'Edit the current user profile.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.permissions (key, label, description)
values
  ('drive.read', 'Read Drive Lite', 'View permitted workspace files and folders.'),
  ('drive.write', 'Write Drive Lite', 'Upload and organize workspace files.'),
  ('drive.manage', 'Manage Drive Lite', 'Manage restricted files, folders, and storage settings.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.permissions (key, label, description)
values
  ('docs.read', 'Read Docs', 'View permitted workspace documents.'),
  ('docs.write', 'Write Docs', 'Create and edit workspace documents.'),
  ('docs.manage', 'Manage Docs', 'Manage document sharing, folders, and publishing.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.permissions (key, label, description)
values
  ('tables.read', 'Read Tables', 'View workspace tables, rows, comments, and activity.'),
  ('tables.write', 'Write Tables', 'Create and edit tables, columns, rows, comments, and views.'),
  ('tables.manage', 'Manage Tables', 'Delete tables and perform other destructive table maintenance.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'owner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('workspace.read', 'workspace.update', 'members.read', 'members.manage', 'audit.read', 'modules.read', 'profile.update')
where r.name = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('workspace.read', 'members.read', 'modules.read', 'profile.update')
where r.name = 'member'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('workspace.read', 'members.read', 'modules.read')
where r.name = 'viewer'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.key in ('drive.read', 'drive.write', 'drive.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'member'
  and p.key in ('drive.read', 'drive.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'viewer'
  and p.key = 'drive.read'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin') and p.key in ('docs.read', 'docs.write', 'docs.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'member' and p.key in ('docs.read', 'docs.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'viewer' and p.key = 'docs.read'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name in ('owner', 'admin')
  and p.key in ('tables.read', 'tables.write', 'tables.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'member'
  and p.key in ('tables.read', 'tables.write')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'viewer'
  and p.key = 'tables.read'
on conflict do nothing;

insert into public.dashboard_preferences (workspace_id, user_id)
select w.id, w.owner_id
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id, user_id) do nothing;

insert into public.pinned_modules (workspace_id, user_id, module_slug, position)
select w.id, w.owner_id, pinned.module_slug, pinned.position
from public.workspaces w
cross join (values ('hub', 0), ('settings', 1)) as pinned(module_slug, position)
where w.deleted_at is null
on conflict (workspace_id, user_id, module_slug) do nothing;

insert into public.recent_items (workspace_id, user_id, entity_type, entity_id, label, href, icon)
select w.id, w.owner_id, 'workspace', w.id, w.name, '/settings/workspace', '⚙'
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id, user_id, entity_type, entity_id) do nothing;

insert into public.notifications (workspace_id, user_id, title, body, kind, href)
select w.id, w.owner_id, 'Workspace ready', 'Your Elyqora Hub is ready for its first pieces of work.', 'success', '/hub'
from public.workspaces w
where w.deleted_at is null
  and not exists (
    select 1 from public.notifications n
    where n.workspace_id = w.id
      and n.user_id = w.owner_id
      and n.title = 'Workspace ready'
  );

insert into public.drive_storage_settings (workspace_id)
select w.id
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id) do nothing;

insert into public.drive_folders (workspace_id, parent_id, name, created_by, updated_by)
select w.id, null, 'Welcome', w.owner_id, w.owner_id
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id, parent_id, name) do nothing;

insert into public.document_folders (workspace_id, name, created_by, updated_by)
select w.id, 'Welcome', w.owner_id, w.owner_id
from public.workspaces w
where w.deleted_at is null
  and not exists (
    select 1 from public.document_folders folder_record
    where folder_record.workspace_id = w.id
      and folder_record.parent_id is null
      and folder_record.name = 'Welcome'
      and folder_record.deleted_at is null
  );

insert into public.documents (workspace_id, folder_id, title, content_md, status, visibility, published_title, published_content_md, published_at, published_by, created_by, updated_by)
select w.id, folder_record.id, 'Welcome to Elyqora Docs', E'# Welcome to Elyqora Docs\n\nThis is your workspace writing room. Use Markdown, save drafts safely, and publish only what you want to share.', 'published', 'workspace', 'Welcome to Elyqora Docs', E'# Welcome to Elyqora Docs\n\nThis is your workspace writing room. Use Markdown, save drafts safely, and publish only what you want to share.', now(), w.owner_id, w.owner_id, w.owner_id
from public.workspaces w
join public.document_folders folder_record on folder_record.workspace_id = w.id and folder_record.parent_id is null and folder_record.name = 'Welcome' and folder_record.deleted_at is null
where w.deleted_at is null
  and not exists (
    select 1 from public.documents document_record
    where document_record.workspace_id = w.id and document_record.title = 'Welcome to Elyqora Docs' and document_record.deleted_at is null
  );

insert into public.document_versions (workspace_id, document_id, version_number, title, content_md, status, visibility, created_by)
select document_record.workspace_id, document_record.id, 1, document_record.title, document_record.content_md, document_record.status, document_record.visibility, document_record.created_by
from public.documents document_record
where document_record.title = 'Welcome to Elyqora Docs'
  and not exists (select 1 from public.document_versions version_record where version_record.document_id = document_record.id);

insert into public.workspace_tables (workspace_id, name, description, created_by, updated_by)
select w.id, 'Workspace tracker', 'Track lightweight work without spreadsheet sprawl.', w.owner_id, w.owner_id
from public.workspaces w
where w.deleted_at is null
  and not exists (
    select 1
    from public.workspace_tables existing
    where existing.workspace_id = w.id
      and existing.name = 'Workspace tracker'
      and existing.deleted_at is null
  );

with tracker as (
  select table_record.id as table_id, table_record.workspace_id, workspace_record.owner_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_columns (workspace_id, table_id, name, column_key, column_type, position, is_hidden, is_required, settings, created_by, updated_by)
select tracker.workspace_id, tracker.table_id, 'Status', 'status', 'single_select', 1, false, false, jsonb_build_object('options', jsonb_build_array('Planned', 'In progress', 'Complete')), tracker.owner_id, tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_columns existing
  where existing.table_id = tracker.table_id
    and existing.column_key = 'status'
);

with tracker as (
  select table_record.id as table_id, table_record.workspace_id, workspace_record.owner_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_columns (workspace_id, table_id, name, column_key, column_type, position, is_hidden, is_required, settings, created_by, updated_by)
select tracker.workspace_id, tracker.table_id, 'Priority', 'priority', 'single_select', 2, false, false, jsonb_build_object('options', jsonb_build_array('Low', 'Medium', 'High')), tracker.owner_id, tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_columns existing
  where existing.table_id = tracker.table_id
    and existing.column_key = 'priority'
);

with tracker as (
  select table_record.id as table_id, table_record.workspace_id, workspace_record.owner_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_columns (workspace_id, table_id, name, column_key, column_type, position, is_hidden, is_required, settings, created_by, updated_by)
select tracker.workspace_id, tracker.table_id, 'Assignee', 'assignee', 'user_reference', 3, false, false, '{}'::jsonb, tracker.owner_id, tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_columns existing
  where existing.table_id = tracker.table_id
    and existing.column_key = 'assignee'
);

with tracker as (
  select table_record.id as table_id, table_record.workspace_id, workspace_record.owner_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_columns (workspace_id, table_id, name, column_key, column_type, position, is_hidden, is_required, settings, created_by, updated_by)
select tracker.workspace_id, tracker.table_id, 'Due date', 'due_date', 'date', 4, false, false, '{}'::jsonb, tracker.owner_id, tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_columns existing
  where existing.table_id = tracker.table_id
    and existing.column_key = 'due_date'
);

with tracker as (
  select table_record.id as table_id, table_record.workspace_id, workspace_record.owner_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_columns (workspace_id, table_id, name, column_key, column_type, position, is_hidden, is_required, settings, created_by, updated_by)
select tracker.workspace_id, tracker.table_id, 'Notes', 'notes', 'long_text', 5, false, false, '{}'::jsonb, tracker.owner_id, tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_columns existing
  where existing.table_id = tracker.table_id
    and existing.column_key = 'notes'
);

with tracker as (
  select
    table_record.id as table_id,
    table_record.workspace_id,
    workspace_record.owner_id,
    name_column.id as name_column_id,
    status_column.id as status_column_id,
    priority_column.id as priority_column_id,
    assignee_column.id as assignee_column_id,
    due_date_column.id as due_date_column_id,
    notes_column.id as notes_column_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  join public.table_columns name_column on name_column.table_id = table_record.id and name_column.column_key = 'name'
  join public.table_columns status_column on status_column.table_id = table_record.id and status_column.column_key = 'status'
  join public.table_columns priority_column on priority_column.table_id = table_record.id and priority_column.column_key = 'priority'
  join public.table_columns assignee_column on assignee_column.table_id = table_record.id and assignee_column.column_key = 'assignee'
  join public.table_columns due_date_column on due_date_column.table_id = table_record.id and due_date_column.column_key = 'due_date'
  join public.table_columns notes_column on notes_column.table_id = table_record.id and notes_column.column_key = 'notes'
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_views (workspace_id, table_id, name, is_default, filter_rules, sort_rules, hidden_column_ids, column_order, created_by, updated_by)
select
  tracker.workspace_id,
  tracker.table_id,
  'Open items',
  false,
  jsonb_build_array(jsonb_build_object('column_id', tracker.status_column_id, 'operator', 'not_equals', 'value', 'Complete')),
  jsonb_build_array(jsonb_build_object('column_id', tracker.due_date_column_id, 'direction', 'asc')),
  array[tracker.notes_column_id]::uuid[],
  coalesce(
    (
      select array_agg(column_record.id order by column_record.position)
      from public.table_columns column_record
      where column_record.table_id = tracker.table_id
    ),
    '{}'::uuid[]
  ),
  tracker.owner_id,
  tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_views existing
  where existing.table_id = tracker.table_id
    and existing.name = 'Open items'
);

with tracker as (
  select
    table_record.id as table_id,
    table_record.workspace_id,
    workspace_record.owner_id,
    name_column.id as name_column_id,
    status_column.id as status_column_id,
    priority_column.id as priority_column_id,
    assignee_column.id as assignee_column_id,
    due_date_column.id as due_date_column_id,
    notes_column.id as notes_column_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  join public.table_columns name_column on name_column.table_id = table_record.id and name_column.column_key = 'name'
  join public.table_columns status_column on status_column.table_id = table_record.id and status_column.column_key = 'status'
  join public.table_columns priority_column on priority_column.table_id = table_record.id and priority_column.column_key = 'priority'
  join public.table_columns assignee_column on assignee_column.table_id = table_record.id and assignee_column.column_key = 'assignee'
  join public.table_columns due_date_column on due_date_column.table_id = table_record.id and due_date_column.column_key = 'due_date'
  join public.table_columns notes_column on notes_column.table_id = table_record.id and notes_column.column_key = 'notes'
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_rows (workspace_id, table_id, row_order, cell_values, created_by, updated_by)
select
  tracker.workspace_id,
  tracker.table_id,
  0,
  jsonb_build_object(
    tracker.name_column_id::text, 'Workspace launch',
    tracker.status_column_id::text, 'In progress',
    tracker.priority_column_id::text, 'High',
    tracker.assignee_column_id::text, tracker.owner_id::text,
    tracker.due_date_column_id::text, to_char(current_date + 7, 'YYYY-MM-DD'),
    tracker.notes_column_id::text, 'Finish onboarding copy and review remaining setup tasks.'
  ),
  tracker.owner_id,
  tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_rows existing
  where existing.table_id = tracker.table_id
    and existing.deleted_at is null
    and existing.cell_values ->> tracker.name_column_id::text = 'Workspace launch'
);

with tracker as (
  select
    table_record.id as table_id,
    table_record.workspace_id,
    workspace_record.owner_id,
    name_column.id as name_column_id,
    status_column.id as status_column_id,
    priority_column.id as priority_column_id,
    assignee_column.id as assignee_column_id,
    due_date_column.id as due_date_column_id,
    notes_column.id as notes_column_id
  from public.workspace_tables table_record
  join public.workspaces workspace_record on workspace_record.id = table_record.workspace_id
  join public.table_columns name_column on name_column.table_id = table_record.id and name_column.column_key = 'name'
  join public.table_columns status_column on status_column.table_id = table_record.id and status_column.column_key = 'status'
  join public.table_columns priority_column on priority_column.table_id = table_record.id and priority_column.column_key = 'priority'
  join public.table_columns assignee_column on assignee_column.table_id = table_record.id and assignee_column.column_key = 'assignee'
  join public.table_columns due_date_column on due_date_column.table_id = table_record.id and due_date_column.column_key = 'due_date'
  join public.table_columns notes_column on notes_column.table_id = table_record.id and notes_column.column_key = 'notes'
  where table_record.deleted_at is null
    and workspace_record.deleted_at is null
    and table_record.name = 'Workspace tracker'
)
insert into public.table_rows (workspace_id, table_id, row_order, cell_values, created_by, updated_by)
select
  tracker.workspace_id,
  tracker.table_id,
  1,
  jsonb_build_object(
    tracker.name_column_id::text, 'Quarterly review',
    tracker.status_column_id::text, 'Planned',
    tracker.priority_column_id::text, 'Medium',
    tracker.assignee_column_id::text, tracker.owner_id::text,
    tracker.due_date_column_id::text, to_char(current_date + 14, 'YYYY-MM-DD'),
    tracker.notes_column_id::text, 'Use this tracker to keep the first workspace milestones visible.'
  ),
  tracker.owner_id,
  tracker.owner_id
from tracker
where not exists (
  select 1
  from public.table_rows existing
  where existing.table_id = tracker.table_id
    and existing.deleted_at is null
    and existing.cell_values ->> tracker.name_column_id::text = 'Quarterly review'
);
