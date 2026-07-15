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
