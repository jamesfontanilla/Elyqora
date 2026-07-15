create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_statuses (
  key text primary key,
  label text not null,
  description text not null default '',
  is_terminal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('owner', 'admin', 'member', 'viewer')),
  label text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique,
  workspace_type text not null default 'team' check (workspace_type in ('personal', 'team', 'nonprofit', 'education', 'operations')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active' references public.membership_statuses(key),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text,
  token_hash text not null unique,
  token_preview text not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_updated_at_idx on public.profiles(updated_at);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id);
create index if not exists workspaces_deleted_at_idx on public.workspaces(deleted_at);
create index if not exists memberships_workspace_idx on public.memberships(workspace_id);
create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_status_idx on public.memberships(status);
create index if not exists invitations_workspace_idx on public.workspace_invitations(workspace_id);
create index if not exists invitations_expires_idx on public.workspace_invitations(expires_at);
create index if not exists audit_workspace_created_idx on public.audit_events(workspace_id, created_at desc);

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(input)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute procedure public.set_updated_at();

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute procedure public.set_updated_at();

drop trigger if exists invitations_set_updated_at on public.workspace_invitations;
create trigger invitations_set_updated_at before update on public.workspace_invitations
  for each row execute procedure public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.workspaces w on w.id = m.workspace_id and w.deleted_at is null
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_workspace_permission(target_workspace_id uuid, required_permission text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.workspaces w on w.id = m.workspace_id and w.deleted_at is null
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = required_permission
  );
$$;

create or replace function public.record_audit_event(
  target_workspace_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id uuid default null,
  event_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  if auth.uid() is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized to record an audit event';
  end if;

  insert into public.audit_events (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_workspace_id, auth.uid(), event_action, event_entity_type, event_entity_id, coalesce(event_metadata, '{}'::jsonb))
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.create_workspace_for_current_user(
  p_workspace_name text,
  p_workspace_type text default 'team'
)
returns table (id uuid, name text, slug text, workspace_type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace public.workspaces;
  owner_role uuid;
  base_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(p_workspace_name)) not between 2 and 80 then
    raise exception 'Workspace name must be between 2 and 80 characters';
  end if;
  if p_workspace_type not in ('personal', 'team', 'nonprofit', 'education', 'operations') then
    raise exception 'Invalid workspace type';
  end if;

  insert into public.profiles (id, full_name)
  select auth.uid(), coalesce(u.raw_user_meta_data ->> 'full_name', '')
  from auth.users u where u.id = auth.uid()
  on conflict do nothing;

  select r.id into owner_role from public.roles as r where r.name = 'owner';
  base_slug := coalesce(nullif(public.slugify(p_workspace_name), ''), 'workspace') || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.workspaces (name, slug, workspace_type, owner_id, created_by, updated_by)
  values (trim(p_workspace_name), base_slug, p_workspace_type, auth.uid(), auth.uid(), auth.uid())
  returning * into new_workspace;

  insert into public.memberships (workspace_id, user_id, role_id, status, created_by, updated_by)
  values (new_workspace.id, auth.uid(), owner_role, 'active', auth.uid(), auth.uid());

  perform public.record_audit_event(new_workspace.id, 'workspace.created', 'workspace', new_workspace.id, jsonb_build_object('workspace_type', p_workspace_type));
  return query select new_workspace.id, new_workspace.name, new_workspace.slug, new_workspace.workspace_type;
end;
$$;

create or replace function public.update_membership_role(target_membership_id uuid, next_role_name text)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.memberships;
  next_role uuid;
begin
  select * into target_membership from public.memberships where id = target_membership_id;
  if not found or not public.has_workspace_permission(target_membership.workspace_id, 'members.manage') then
    raise exception 'Not authorized to change this membership';
  end if;
  if next_role_name not in ('admin', 'member', 'viewer') then
    raise exception 'Owners cannot be reassigned';
  end if;
  if target_membership.user_id = auth.uid() then
    raise exception 'Use workspace ownership controls to change your own role';
  end if;
  if target_membership.role_id = (select r.id from public.roles as r where r.name = 'owner') then
    raise exception 'The workspace owner role cannot be reassigned';
  end if;

  select r.id into next_role from public.roles as r where r.name = next_role_name;
  update public.memberships
  set role_id = next_role, updated_by = auth.uid()
  where id = target_membership_id
  returning * into target_membership;

  perform public.record_audit_event(target_membership.workspace_id, 'membership.role_changed', 'membership', target_membership.id, jsonb_build_object('role', next_role_name, 'user_id', target_membership.user_id));
  return target_membership;
end;
$$;

create or replace function public.remove_workspace_member(target_membership_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.memberships;
begin
  select * into target_membership from public.memberships where id = target_membership_id;
  if not found or not public.has_workspace_permission(target_membership.workspace_id, 'members.manage') then
    raise exception 'Not authorized to remove this membership';
  end if;
  if target_membership.user_id = auth.uid() then
    raise exception 'You cannot remove yourself from a workspace';
  end if;
  if target_membership.user_id = (select owner_id from public.workspaces where id = target_membership.workspace_id)
     or target_membership.role_id = (select r.id from public.roles as r where r.name = 'owner') then
    raise exception 'The workspace owner cannot be removed';
  end if;

  update public.memberships
  set status = 'removed', updated_by = auth.uid()
  where id = target_membership_id
  returning * into target_membership;

  perform public.record_audit_event(target_membership.workspace_id, 'membership.removed', 'membership', target_membership.id, jsonb_build_object('user_id', target_membership.user_id));
  return target_membership;
end;
$$;

create or replace function public.accept_workspace_invitation(token_hash_input text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations;
  member_role uuid;
  accepted_workspace public.workspaces;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into invitation
  from public.workspace_invitations
  where token_hash = token_hash_input and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'Invitation is invalid or expired';
  end if;

  select email into account_email from auth.users where id = auth.uid();
  if invitation.email is not null and lower(invitation.email) <> lower(coalesce(account_email, '')) then
    raise exception 'This invitation is restricted to another email address';
  end if;

  select r.id into member_role from public.roles as r where r.name = 'member';
  insert into public.memberships (workspace_id, user_id, role_id, status, created_by, updated_by)
  values (invitation.workspace_id, auth.uid(), member_role, 'active', auth.uid(), auth.uid())
  on conflict (workspace_id, user_id) do update set status = 'active', updated_by = auth.uid();

  update public.workspace_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  where id = invitation.id;

  select * into accepted_workspace from public.workspaces where id = invitation.workspace_id;
  perform public.record_audit_event(invitation.workspace_id, 'membership.invitation_accepted', 'workspace_invitation', invitation.id, '{}'::jsonb);
  return accepted_workspace;
end;
$$;

create or replace function public.soft_delete_workspace(target_workspace_id uuid)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_workspace public.workspaces;
begin
  if not public.has_workspace_permission(target_workspace_id, 'workspace.delete') then
    raise exception 'Only the workspace owner can delete this workspace';
  end if;

  select * into deleted_workspace from public.workspaces
  where id = target_workspace_id and owner_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'Workspace was not found or is already deleted';
  end if;

  perform public.record_audit_event(target_workspace_id, 'workspace.deleted', 'workspace', target_workspace_id, '{}'::jsonb);

  update public.workspaces
  set deleted_at = now(), updated_by = auth.uid()
  where id = target_workspace_id and owner_id = auth.uid() and deleted_at is null
  returning * into deleted_workspace;
  if not found then
    raise exception 'Workspace was not found or is already deleted';
  end if;
  return deleted_workspace;
end;
$$;

alter table public.profiles enable row level security;
alter table public.membership_statuses enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_workspace_member_read on public.profiles;
create policy profiles_workspace_member_read on public.profiles for select using (
  exists (
    select 1
    from public.memberships member_record
    where member_record.user_id = profiles.id
      and member_record.status = 'active'
      and public.is_workspace_member(member_record.workspace_id)
  )
);

drop policy if exists membership_statuses_authenticated_read on public.membership_statuses;
create policy membership_statuses_authenticated_read on public.membership_statuses for select to authenticated using (true);
drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles for select to authenticated using (true);
drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions for select to authenticated using (true);
drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read on public.role_permissions for select to authenticated using (true);

drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_member_read on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists workspaces_authenticated_create on public.workspaces;
create policy workspaces_authenticated_create on public.workspaces for insert to authenticated with check (owner_id = auth.uid() and created_by = auth.uid());
drop policy if exists workspaces_manager_update on public.workspaces;
create policy workspaces_manager_update on public.workspaces for update using (public.has_workspace_permission(id, 'workspace.update')) with check (public.has_workspace_permission(id, 'workspace.update'));

drop policy if exists memberships_member_read on public.memberships;
create policy memberships_member_read on public.memberships for select using (public.is_workspace_member(workspace_id));
drop policy if exists memberships_manager_insert on public.memberships;
create policy memberships_manager_insert on public.memberships for insert with check (public.has_workspace_permission(workspace_id, 'members.manage'));
drop policy if exists memberships_manager_update on public.memberships;
create policy memberships_manager_update on public.memberships for update using (public.has_workspace_permission(workspace_id, 'members.manage')) with check (public.has_workspace_permission(workspace_id, 'members.manage'));

drop policy if exists invitations_manager_read on public.workspace_invitations;
create policy invitations_manager_read on public.workspace_invitations for select using (public.has_workspace_permission(workspace_id, 'members.manage'));
drop policy if exists invitations_manager_insert on public.workspace_invitations;
create policy invitations_manager_insert on public.workspace_invitations for insert with check (public.has_workspace_permission(workspace_id, 'members.manage') and invited_by = auth.uid());
drop policy if exists invitations_manager_update on public.workspace_invitations;
create policy invitations_manager_update on public.workspace_invitations for update using (public.has_workspace_permission(workspace_id, 'members.manage')) with check (public.has_workspace_permission(workspace_id, 'members.manage'));

drop policy if exists audit_member_read on public.audit_events;
create policy audit_member_read on public.audit_events for select using (public.has_workspace_permission(workspace_id, 'audit.read'));

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update on public.memberships to authenticated;
grant select, insert, update on public.workspace_invitations to authenticated;
grant select on public.membership_statuses, public.roles, public.permissions, public.role_permissions, public.audit_events to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_permission(uuid, text) to authenticated;
grant execute on function public.record_audit_event(uuid, text, text, uuid, jsonb) to authenticated;
grant execute on function public.create_workspace_for_current_user(text, text) to authenticated;
grant execute on function public.update_membership_role(uuid, text) to authenticated;
grant execute on function public.remove_workspace_member(uuid) to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.soft_delete_workspace(uuid) to authenticated;
