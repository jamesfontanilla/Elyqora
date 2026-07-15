create table if not exists public.recent_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid not null,
  label text not null check (char_length(label) between 1 and 160),
  href text not null check (href like '/%'),
  icon text not null default '•',
  open_count integer not null default 1 check (open_count > 0),
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, entity_type, entity_id)
);

create table if not exists public.pinned_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_slug text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, module_slug)
);

create table if not exists public.dashboard_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quick_actions jsonb not null default '["workspace-settings", "members", "profile"]'::jsonb,
  layout jsonb not null default '{"columns": "balanced", "show_recent": true, "show_notifications": true}'::jsonb,
  show_recent boolean not null default true,
  show_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '',
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'mention')),
  href text check (href is null or href like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recent_items_user_workspace_idx on public.recent_items(user_id, workspace_id, last_opened_at desc);
create index if not exists recent_items_workspace_idx on public.recent_items(workspace_id, last_opened_at desc);
create index if not exists pinned_modules_user_workspace_idx on public.pinned_modules(user_id, workspace_id, position);
create index if not exists dashboard_preferences_user_workspace_idx on public.dashboard_preferences(user_id, workspace_id);
create index if not exists notifications_user_workspace_idx on public.notifications(user_id, workspace_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id, workspace_id, read_at) where read_at is null;

drop trigger if exists recent_items_set_updated_at on public.recent_items;
create trigger recent_items_set_updated_at before update on public.recent_items
  for each row execute procedure public.set_updated_at();

drop trigger if exists pinned_modules_set_updated_at on public.pinned_modules;
create trigger pinned_modules_set_updated_at before update on public.pinned_modules
  for each row execute procedure public.set_updated_at();

drop trigger if exists dashboard_preferences_set_updated_at on public.dashboard_preferences;
create trigger dashboard_preferences_set_updated_at before update on public.dashboard_preferences
  for each row execute procedure public.set_updated_at();

create or replace function public.seed_hub_for_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.dashboard_preferences (workspace_id, user_id)
  values (new.id, new.owner_id)
  on conflict (workspace_id, user_id) do nothing;

  insert into public.pinned_modules (workspace_id, user_id, module_slug, position)
  values
    (new.id, new.owner_id, 'hub', 0),
    (new.id, new.owner_id, 'settings', 1)
  on conflict (workspace_id, user_id, module_slug) do nothing;

  insert into public.notifications (workspace_id, user_id, title, body, kind, href)
  values (new.id, new.owner_id, 'Workspace ready', 'Your Elyqora Hub is ready for its first pieces of work.', 'success', '/hub');

  insert into public.recent_items (workspace_id, user_id, entity_type, entity_id, label, href, icon)
  values (new.id, new.owner_id, 'workspace', new.id, new.name, '/settings/workspace', '⚙');

  return new;
end;
$$;

drop trigger if exists workspaces_seed_hub on public.workspaces;
create trigger workspaces_seed_hub
  after insert on public.workspaces
  for each row execute procedure public.seed_hub_for_workspace();

alter table public.recent_items enable row level security;
alter table public.pinned_modules enable row level security;
alter table public.dashboard_preferences enable row level security;
alter table public.notifications enable row level security;

drop policy if exists recent_items_owner_read on public.recent_items;
create policy recent_items_owner_read on public.recent_items for select using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists recent_items_owner_insert on public.recent_items;
create policy recent_items_owner_insert on public.recent_items for insert with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists recent_items_owner_update on public.recent_items;
create policy recent_items_owner_update on public.recent_items for update using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
) with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists recent_items_owner_delete on public.recent_items;
create policy recent_items_owner_delete on public.recent_items for delete using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);

drop policy if exists pinned_modules_owner_read on public.pinned_modules;
create policy pinned_modules_owner_read on public.pinned_modules for select using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists pinned_modules_owner_insert on public.pinned_modules;
create policy pinned_modules_owner_insert on public.pinned_modules for insert with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists pinned_modules_owner_update on public.pinned_modules;
create policy pinned_modules_owner_update on public.pinned_modules for update using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
) with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists pinned_modules_owner_delete on public.pinned_modules;
create policy pinned_modules_owner_delete on public.pinned_modules for delete using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);

drop policy if exists dashboard_preferences_owner_read on public.dashboard_preferences;
create policy dashboard_preferences_owner_read on public.dashboard_preferences for select using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists dashboard_preferences_owner_insert on public.dashboard_preferences;
create policy dashboard_preferences_owner_insert on public.dashboard_preferences for insert with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists dashboard_preferences_owner_update on public.dashboard_preferences;
create policy dashboard_preferences_owner_update on public.dashboard_preferences for update using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
) with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications for select using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update using (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
) with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);

grant select, insert, update, delete on public.recent_items to authenticated;
grant select, insert, update, delete on public.pinned_modules to authenticated;
grant select, insert, update on public.dashboard_preferences to authenticated;
grant select, update on public.notifications to authenticated;
