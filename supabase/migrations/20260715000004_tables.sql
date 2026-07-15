create table if not exists public.workspace_tables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 240),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  unique (workspace_id, name)
);

create table if not exists public.table_columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_id uuid not null references public.workspace_tables(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  column_key text not null check (column_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  column_type text not null check (column_type in ('text', 'long_text', 'number', 'currency', 'boolean', 'date', 'single_select', 'multi_select', 'url', 'user_reference')),
  position integer not null default 0 check (position >= 0),
  is_hidden boolean not null default false,
  is_required boolean not null default false,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_id, column_key)
);

create table if not exists public.table_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_id uuid not null references public.workspace_tables(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  is_default boolean not null default false,
  filter_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(filter_rules) = 'array'),
  sort_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(sort_rules) = 'array'),
  hidden_column_ids uuid[] not null default '{}'::uuid[],
  column_order uuid[] not null default '{}'::uuid[],
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_id, name)
);

create table if not exists public.table_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_id uuid not null references public.workspace_tables(id) on delete cascade,
  row_order bigint not null default 0 check (row_order >= 0),
  cell_values jsonb not null default '{}'::jsonb check (jsonb_typeof(cell_values) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.table_row_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_id uuid not null references public.workspace_tables(id) on delete cascade,
  row_id uuid not null references public.table_rows(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.table_row_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  table_id uuid not null references public.workspace_tables(id) on delete cascade,
  row_id uuid not null references public.table_rows(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_tables_workspace_idx on public.workspace_tables(workspace_id, updated_at desc);
create index if not exists table_columns_table_idx on public.table_columns(table_id, position);
create index if not exists table_views_table_idx on public.table_views(table_id, created_at desc);
create index if not exists table_rows_table_idx on public.table_rows(table_id, row_order asc);
create index if not exists table_rows_workspace_idx on public.table_rows(workspace_id, updated_at desc);
create index if not exists table_row_comments_row_idx on public.table_row_comments(row_id, created_at asc);
create index if not exists table_row_activity_row_idx on public.table_row_activity(row_id, created_at desc);
create index if not exists table_row_activity_table_idx on public.table_row_activity(table_id, created_at desc);

drop trigger if exists workspace_tables_set_updated_at on public.workspace_tables;
create trigger workspace_tables_set_updated_at before update on public.workspace_tables
  for each row execute procedure public.set_updated_at();
drop trigger if exists table_columns_set_updated_at on public.table_columns;
create trigger table_columns_set_updated_at before update on public.table_columns
  for each row execute procedure public.set_updated_at();
drop trigger if exists table_views_set_updated_at on public.table_views;
create trigger table_views_set_updated_at before update on public.table_views
  for each row execute procedure public.set_updated_at();
drop trigger if exists table_rows_set_updated_at on public.table_rows;
create trigger table_rows_set_updated_at before update on public.table_rows
  for each row execute procedure public.set_updated_at();
drop trigger if exists table_row_comments_set_updated_at on public.table_row_comments;
create trigger table_row_comments_set_updated_at before update on public.table_row_comments
  for each row execute procedure public.set_updated_at();

create or replace function public.validate_table_column_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  options text[];
  option_value text;
begin
  if auth.uid() is not null and not public.is_workspace_member(new.workspace_id) then
    raise exception 'Not authorized to change this table';
  end if;
  if not exists (
    select 1
    from public.workspace_tables table_record
    where table_record.id = new.table_id
      and table_record.workspace_id = new.workspace_id
      and table_record.deleted_at is null
  ) then
    raise exception 'The table is not available';
  end if;
  if new.column_type in ('single_select', 'multi_select') then
    if jsonb_typeof(new.settings) <> 'object' or not (new.settings ? 'options') then
      raise exception 'Select columns need options';
    end if;
    if jsonb_typeof(new.settings -> 'options') <> 'array' or jsonb_array_length(new.settings -> 'options') = 0 then
      raise exception 'Select columns need at least one option';
    end if;
    options := array(
      select distinct trim(value)
      from jsonb_array_elements_text(new.settings -> 'options') as value
      where trim(value) <> ''
      limit 50
    );
    if coalesce(cardinality(options), 0) = 0 then
      raise exception 'Select columns need at least one option';
    end if;
    new.settings := jsonb_build_object('options', to_jsonb(options));
  elsif new.column_type = 'currency' then
    new.settings := jsonb_build_object(
      'precision', greatest(0, least(6, coalesce((new.settings ->> 'precision')::integer, 2))),
      'currency_code', upper(coalesce(nullif(trim(new.settings ->> 'currency_code'), ''), 'USD'))
    );
  else
    new.settings := coalesce(new.settings, '{}'::jsonb);
  end if;
  return new;
end;
$$;

create or replace function public.validate_table_row_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  column_record record;
  value_record record;
  cell_value jsonb;
  text_value text;
  options text[];
begin
  if auth.uid() is not null and not public.is_workspace_member(new.workspace_id) then
    raise exception 'Not authorized to change this table row';
  end if;
  if not exists (
    select 1
    from public.workspace_tables table_record
    where table_record.id = new.table_id
      and table_record.workspace_id = new.workspace_id
      and table_record.deleted_at is null
  ) then
    raise exception 'The table is not available';
  end if;
  if new.cell_values is null or jsonb_typeof(new.cell_values) <> 'object' then
    raise exception 'Table row values must be a JSON object';
  end if;

  for column_record in
    select id::text as id, column_type, settings, is_required
    from public.table_columns
    where table_id = new.table_id
  loop
    cell_value := new.cell_values -> column_record.id;
    if column_record.is_required and (cell_value is null or jsonb_typeof(cell_value) = 'null' or cell_value #>> '{}' = '') then
      raise exception 'Required columns cannot be empty';
    end if;
  end loop;

  for value_record in select * from jsonb_each(new.cell_values)
  loop
    select id::text as id, column_type, settings into column_record
    from public.table_columns
    where table_id = new.table_id
      and id::text = value_record.key;
    if not found then
      raise exception 'Unknown column %', value_record.key;
    end if;
    case column_record.column_type
      when 'text', 'long_text', 'url' then
        if jsonb_typeof(value_record.value) not in ('string', 'null') then
          raise exception 'Column % expects text', value_record.key;
        end if;
        text_value := value_record.value #>> '{}';
        if column_record.column_type = 'text' and char_length(coalesce(text_value, '')) > 240 then
          raise exception 'Text columns must stay under 240 characters';
        end if;
        if column_record.column_type = 'long_text' and char_length(coalesce(text_value, '')) > 10000 then
          raise exception 'Long text columns must stay under 10000 characters';
        end if;
        if column_record.column_type = 'url' and coalesce(text_value, '') !~ '^https?://[^\s]+$' then
          raise exception 'URL columns must contain a safe http or https link';
        end if;
      when 'number', 'currency' then
        if jsonb_typeof(value_record.value) not in ('number', 'string', 'null') then
          raise exception 'Column % expects a number', value_record.key;
        end if;
        if jsonb_typeof(value_record.value) = 'string' then
          text_value := replace(value_record.value #>> '{}', ',', '');
          if text_value = '' or not text_value ~ '^-?[0-9]+(\.[0-9]+)?$' then
            raise exception 'Column % expects a valid number', value_record.key;
          end if;
        end if;
      when 'boolean' then
        if jsonb_typeof(value_record.value) not in ('boolean', 'null') then
          raise exception 'Column % expects yes or no', value_record.key;
        end if;
      when 'date' then
        if jsonb_typeof(value_record.value) not in ('string', 'null') then
          raise exception 'Column % expects a date', value_record.key;
        end if;
        text_value := value_record.value #>> '{}';
        if coalesce(text_value, '') <> '' and text_value !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Column % expects YYYY-MM-DD', value_record.key;
        end if;
      when 'single_select' then
        if jsonb_typeof(value_record.value) not in ('string', 'null') then
          raise exception 'Column % expects a single choice', value_record.key;
        end if;
        text_value := value_record.value #>> '{}';
        options := array(select jsonb_array_elements_text(coalesce(column_record.settings -> 'options', '[]'::jsonb)));
        if coalesce(text_value, '') <> '' and not text_value = any(options) then
          raise exception 'Column % expects one of its defined options', value_record.key;
        end if;
      when 'multi_select' then
        if jsonb_typeof(value_record.value) not in ('array', 'null') then
          raise exception 'Column % expects many choices', value_record.key;
        end if;
        options := array(select jsonb_array_elements_text(coalesce(column_record.settings -> 'options', '[]'::jsonb)));
        for text_value in select jsonb_array_elements_text(coalesce(value_record.value, '[]'::jsonb))
        loop
          if text_value <> '' and not text_value = any(options) then
            raise exception 'Column % expects one of its defined options', value_record.key;
          end if;
        end loop;
      when 'user_reference' then
        if jsonb_typeof(value_record.value) not in ('string', 'null') then
          raise exception 'Column % expects a workspace member', value_record.key;
        end if;
        text_value := value_record.value #>> '{}';
        if coalesce(text_value, '') <> '' and not exists (
          select 1
          from public.memberships member_record
          where member_record.workspace_id = new.workspace_id
            and member_record.user_id = text_value::uuid
            and member_record.status = 'active'
        ) then
          raise exception 'Column % expects an active workspace member', value_record.key;
        end if;
      else
        raise exception 'Unsupported column type';
    end case;
  end loop;

  return new;
end;
$$;

create or replace function public.record_table_row_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  actor_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    action_name := 'row.created';
    insert into public.table_row_activity (workspace_id, table_id, row_id, actor_id, action, metadata)
    values (new.workspace_id, new.table_id, new.id, actor_id, action_name, jsonb_build_object('row_order', new.row_order));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      action_name := 'row.deleted';
    elsif old.deleted_at is not null and new.deleted_at is null then
      action_name := 'row.restored';
    else
      action_name := 'row.updated';
    end if;
    insert into public.table_row_activity (workspace_id, table_id, row_id, actor_id, action, metadata)
    values (
      new.workspace_id,
      new.table_id,
      new.id,
      actor_id,
      action_name,
      jsonb_build_object('before', coalesce(to_jsonb(old.cell_values), '{}'::jsonb), 'after', coalesce(to_jsonb(new.cell_values), '{}'::jsonb))
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.table_row_activity (workspace_id, table_id, row_id, actor_id, action, metadata)
    values (
      old.workspace_id,
      old.table_id,
      old.id,
      actor_id,
      'row.deleted',
      jsonb_build_object('before', coalesce(to_jsonb(old.cell_values), '{}'::jsonb))
    );
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.record_table_lifecycle_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if old.name is distinct from new.name then
      perform public.record_audit_event(new.workspace_id, 'table.renamed', 'table', new.id, jsonb_build_object('name', new.name));
    end if;
    if old.deleted_at is null and new.deleted_at is not null then
      perform public.record_audit_event(new.workspace_id, 'table.deleted', 'table', new.id, jsonb_build_object('name', new.name));
    elsif old.deleted_at is not null and new.deleted_at is null then
      perform public.record_audit_event(new.workspace_id, 'table.restored', 'table', new.id, jsonb_build_object('name', new.name));
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.seed_table_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_column_id uuid;
begin
  insert into public.table_columns (workspace_id, table_id, name, column_key, column_type, position, is_hidden, is_required, settings, created_by, updated_by)
  values (new.workspace_id, new.id, 'Name', 'name', 'text', 0, false, true, '{}'::jsonb, new.created_by, new.created_by)
  on conflict (table_id, column_key) do nothing
  returning id into default_column_id;

  if default_column_id is null then
    select id into default_column_id from public.table_columns where table_id = new.id and column_key = 'name';
  end if;

  insert into public.table_views (workspace_id, table_id, name, is_default, filter_rules, sort_rules, hidden_column_ids, column_order, created_by, updated_by)
  values (new.workspace_id, new.id, 'All rows', true, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], '{}'::uuid[], new.created_by, new.created_by)
  on conflict (table_id, name) do nothing;

  if auth.uid() is not null then
    perform public.record_audit_event(new.workspace_id, 'table.created', 'table', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_tables_seed_defaults on public.workspace_tables;
create trigger workspace_tables_seed_defaults after insert on public.workspace_tables
  for each row execute procedure public.seed_table_defaults();
drop trigger if exists workspace_tables_record_activity on public.workspace_tables;
create trigger workspace_tables_record_activity after update on public.workspace_tables
  for each row execute procedure public.record_table_lifecycle_activity();
drop trigger if exists table_columns_validate on public.table_columns;
create trigger table_columns_validate before insert or update on public.table_columns
  for each row execute procedure public.validate_table_column_record();
drop trigger if exists table_rows_validate on public.table_rows;
create trigger table_rows_validate before insert or update on public.table_rows
  for each row execute procedure public.validate_table_row_record();
drop trigger if exists table_rows_record_activity on public.table_rows;
create trigger table_rows_record_activity after insert or update or delete on public.table_rows
  for each row execute procedure public.record_table_row_activity();

insert into public.permissions (key, label, description)
values
  ('tables.read', 'Read Tables', 'View workspace tables, rows, comments, and activity.'),
  ('tables.write', 'Write Tables', 'Create and edit tables, columns, rows, comments, and views.'),
  ('tables.manage', 'Manage Tables', 'Delete tables and perform other destructive table maintenance.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

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

alter table public.workspace_tables enable row level security;
alter table public.table_columns enable row level security;
alter table public.table_views enable row level security;
alter table public.table_rows enable row level security;
alter table public.table_row_comments enable row level security;
alter table public.table_row_activity enable row level security;

drop policy if exists workspace_tables_member_read on public.workspace_tables;
create policy workspace_tables_member_read on public.workspace_tables for select using (deleted_at is null and public.has_workspace_permission(workspace_id, 'tables.read'));
drop policy if exists workspace_tables_writer_insert on public.workspace_tables;
create policy workspace_tables_writer_insert on public.workspace_tables for insert with check (created_by = auth.uid() and updated_by = auth.uid() and public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists workspace_tables_writer_update on public.workspace_tables;
create policy workspace_tables_writer_update on public.workspace_tables for update using (public.has_workspace_permission(workspace_id, 'tables.write')) with check (public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists workspace_tables_manager_delete on public.workspace_tables;
create policy workspace_tables_manager_delete on public.workspace_tables for delete using (public.has_workspace_permission(workspace_id, 'tables.manage'));

drop policy if exists table_columns_member_read on public.table_columns;
create policy table_columns_member_read on public.table_columns for select using (public.has_workspace_permission(workspace_id, 'tables.read'));
drop policy if exists table_columns_writer_insert on public.table_columns;
create policy table_columns_writer_insert on public.table_columns for insert with check (created_by = auth.uid() and updated_by = auth.uid() and public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_columns_writer_update on public.table_columns;
create policy table_columns_writer_update on public.table_columns for update using (public.has_workspace_permission(workspace_id, 'tables.write')) with check (public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_columns_manager_delete on public.table_columns;
create policy table_columns_manager_delete on public.table_columns for delete using (public.has_workspace_permission(workspace_id, 'tables.manage'));

drop policy if exists table_views_member_read on public.table_views;
create policy table_views_member_read on public.table_views for select using (public.has_workspace_permission(workspace_id, 'tables.read'));
drop policy if exists table_views_writer_insert on public.table_views;
create policy table_views_writer_insert on public.table_views for insert with check (created_by = auth.uid() and updated_by = auth.uid() and public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_views_writer_update on public.table_views;
create policy table_views_writer_update on public.table_views for update using (public.has_workspace_permission(workspace_id, 'tables.write')) with check (public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_views_writer_delete on public.table_views;
create policy table_views_writer_delete on public.table_views for delete using (public.has_workspace_permission(workspace_id, 'tables.write'));

drop policy if exists table_rows_member_read on public.table_rows;
create policy table_rows_member_read on public.table_rows for select using (public.has_workspace_permission(workspace_id, 'tables.read') and (deleted_at is null or public.has_workspace_permission(workspace_id, 'tables.manage')));
drop policy if exists table_rows_writer_insert on public.table_rows;
create policy table_rows_writer_insert on public.table_rows for insert with check (created_by = auth.uid() and updated_by = auth.uid() and public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_rows_writer_update on public.table_rows;
create policy table_rows_writer_update on public.table_rows for update using (public.has_workspace_permission(workspace_id, 'tables.write')) with check (public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_rows_manager_delete on public.table_rows;
create policy table_rows_manager_delete on public.table_rows for delete using (public.has_workspace_permission(workspace_id, 'tables.manage'));

drop policy if exists table_row_comments_member_read on public.table_row_comments;
create policy table_row_comments_member_read on public.table_row_comments for select using (public.has_workspace_permission(workspace_id, 'tables.read'));
drop policy if exists table_row_comments_writer_insert on public.table_row_comments;
create policy table_row_comments_writer_insert on public.table_row_comments for insert with check (author_id = auth.uid() and public.has_workspace_permission(workspace_id, 'tables.write'));
drop policy if exists table_row_comments_writer_update on public.table_row_comments;
create policy table_row_comments_writer_update on public.table_row_comments for update using (author_id = auth.uid() or public.has_workspace_permission(workspace_id, 'tables.manage')) with check (author_id = auth.uid() or public.has_workspace_permission(workspace_id, 'tables.manage'));
drop policy if exists table_row_comments_writer_delete on public.table_row_comments;
create policy table_row_comments_writer_delete on public.table_row_comments for delete using (author_id = auth.uid() or public.has_workspace_permission(workspace_id, 'tables.manage'));

drop policy if exists table_row_activity_member_read on public.table_row_activity;
create policy table_row_activity_member_read on public.table_row_activity for select using (public.has_workspace_permission(workspace_id, 'tables.read'));

grant select, insert, update, delete on public.workspace_tables to authenticated;
grant select, insert, update, delete on public.table_columns to authenticated;
grant select, insert, update, delete on public.table_views to authenticated;
grant select, insert, update, delete on public.table_rows to authenticated;
grant select, insert, update, delete on public.table_row_comments to authenticated;
grant select on public.table_row_activity to authenticated;
