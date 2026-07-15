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
