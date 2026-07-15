create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.document_folders(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and name !~ '[\\\\/]'),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.document_folders(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  public_slug text unique,
  content_md text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'private' check (visibility in ('private', 'workspace', 'public')),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_title text,
  published_content_md text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(content_md, ''))
  ) stored
);

alter table public.documents add column if not exists published_title text;
alter table public.documents add column if not exists published_content_md text;

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  content_md text not null default '',
  status text not null check (status in ('draft', 'published')),
  visibility text not null check (visibility in ('private', 'workspace', 'public')),
  public_slug text,
  created_by uuid not null references auth.users(id) on delete restrict,
  restored_from_id uuid references public.document_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists public.document_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.document_tag_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  tag_id uuid not null references public.document_tags(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, tag_id)
);

create table if not exists public.document_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  line_number integer check (line_number is null or line_number > 0),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_mentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  comment_id uuid not null references public.document_comments(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (comment_id, mentioned_user_id)
);

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  target_type text not null check (target_type in ('project', 'task', 'contact', 'ticket', 'event', 'course')),
  target_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, target_type, target_id)
);

create table if not exists public.document_favorites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (document_id, user_id)
);

create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'read' check (permission in ('read', 'edit')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, user_id)
);

create index if not exists document_folders_workspace_parent_idx on public.document_folders(workspace_id, parent_id, name) where deleted_at is null;
create unique index if not exists document_folders_root_name_idx on public.document_folders(workspace_id, name) where parent_id is null and deleted_at is null;
create unique index if not exists document_folders_nested_name_idx on public.document_folders(workspace_id, parent_id, name) where parent_id is not null and deleted_at is null;
create index if not exists documents_workspace_folder_idx on public.documents(workspace_id, folder_id, updated_at desc) where deleted_at is null;
create index if not exists documents_workspace_status_idx on public.documents(workspace_id, status, updated_at desc) where deleted_at is null;
create index if not exists documents_search_vector_idx on public.documents using gin(search_vector);
create index if not exists document_versions_document_idx on public.document_versions(document_id, version_number desc);
create index if not exists document_tags_workspace_idx on public.document_tags(workspace_id, name);
create index if not exists document_tag_links_document_idx on public.document_tag_links(document_id);
create index if not exists document_comments_document_idx on public.document_comments(document_id, created_at desc);
create index if not exists document_mentions_user_idx on public.document_mentions(mentioned_user_id, created_at desc);
create index if not exists document_links_target_idx on public.document_links(workspace_id, target_type, target_id);
create index if not exists document_favorites_user_workspace_idx on public.document_favorites(user_id, workspace_id, created_at desc);
create index if not exists document_shares_document_user_idx on public.document_shares(document_id, user_id);

drop trigger if exists document_folders_set_updated_at on public.document_folders;
create trigger document_folders_set_updated_at before update on public.document_folders
  for each row execute procedure public.set_updated_at();
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents
  for each row execute procedure public.set_updated_at();
drop trigger if exists document_comments_set_updated_at on public.document_comments;
create trigger document_comments_set_updated_at before update on public.document_comments
  for each row execute procedure public.set_updated_at();
drop trigger if exists document_shares_set_updated_at on public.document_shares;
create trigger document_shares_set_updated_at before update on public.document_shares
  for each row execute procedure public.set_updated_at();

create or replace function public.can_read_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents document_record
    where document_record.id = target_document_id
      and document_record.deleted_at is null
      and (
        (document_record.visibility = 'public' and document_record.status = 'published')
        or (
          public.is_workspace_member(document_record.workspace_id)
          and (
            document_record.visibility = 'workspace'
            or document_record.created_by = auth.uid()
            or exists (
              select 1
              from public.document_shares share_record
              where share_record.document_id = document_record.id
                and share_record.user_id = auth.uid()
                and share_record.permission in ('read', 'edit')
            )
          )
        )
      )
  );
$$;

create or replace function public.can_edit_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents document_record
    where document_record.id = target_document_id
      and public.is_workspace_member(document_record.workspace_id)
      and (
        document_record.created_by = auth.uid()
        or public.has_workspace_permission(document_record.workspace_id, 'docs.manage')
        or exists (
          select 1
          from public.document_shares share_record
          where share_record.document_id = document_record.id
            and share_record.user_id = auth.uid()
            and share_record.permission = 'edit'
        )
      )
  );
$$;

create or replace function public.document_workspace_id(target_document_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.documents where id = target_document_id;
$$;

create or replace function public.document_folder_workspace_id(target_folder_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.document_folders where id = target_folder_id and deleted_at is null;
$$;

create or replace function public.document_tag_workspace_id(target_tag_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.document_tags where id = target_tag_id;
$$;

create or replace function public.create_document_for_current_user(
  p_workspace_id uuid,
  p_folder_id uuid,
  p_title text
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  created_document public.documents;
begin
  if not public.has_workspace_permission(p_workspace_id, 'docs.write') then
    raise exception 'You do not have permission to create documents';
  end if;
  if p_folder_id is not null and not exists (
    select 1 from public.document_folders folder_record
    where folder_record.id = p_folder_id
      and folder_record.workspace_id = p_workspace_id
      and folder_record.deleted_at is null
  ) then
    raise exception 'The document folder is not available';
  end if;

  insert into public.documents (workspace_id, folder_id, title, created_by, updated_by)
  values (p_workspace_id, p_folder_id, left(trim(p_title), 180), auth.uid(), auth.uid())
  returning * into created_document;

  insert into public.document_versions (workspace_id, document_id, version_number, title, content_md, status, visibility, created_by)
  values (p_workspace_id, created_document.id, 1, created_document.title, '', 'draft', 'private', auth.uid());
  perform public.record_audit_event(p_workspace_id, 'document.created', 'document', created_document.id, jsonb_build_object('title', created_document.title));
  return created_document;
end;
$$;

create or replace function public.save_document_draft(
  p_document_id uuid,
  p_title text,
  p_content_md text
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_document public.documents;
begin
  if not public.can_edit_document(p_document_id) then
    raise exception 'You do not have permission to edit this document';
  end if;
  update public.documents
  set title = left(trim(p_title), 180), content_md = left(p_content_md, 1000000), updated_by = auth.uid()
  where id = p_document_id and deleted_at is null
  returning * into updated_document;
  if not found then raise exception 'Document was not found'; end if;
  return updated_document;
end;
$$;

create or replace function public.save_document_version(
  p_document_id uuid,
  p_title text,
  p_content_md text,
  p_visibility text,
  p_status text
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_document public.documents;
  next_version integer;
  next_slug text;
begin
  if not public.can_edit_document(p_document_id) then
    raise exception 'You do not have permission to save this document';
  end if;
  if p_visibility not in ('private', 'workspace', 'public') or p_status not in ('draft', 'published') then
    raise exception 'Document visibility or status is invalid';
  end if;
  if p_visibility = 'public' and p_status <> 'published' then
    raise exception 'Public documents must be published';
  end if;

  select public.documents.public_slug into next_slug from public.documents where id = p_document_id;
  update public.documents
  set title = left(trim(p_title), 180),
      content_md = left(p_content_md, 1000000),
      visibility = p_visibility,
      status = p_status,
      published_title = case when p_status = 'published' then left(trim(p_title), 180) else public.documents.published_title end,
      published_content_md = case when p_status = 'published' then left(p_content_md, 1000000) else public.documents.published_content_md end,
      public_slug = case when p_visibility = 'public' and p_status = 'published' and next_slug is null
        then lower(regexp_replace(left(trim(p_title), 80), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(p_document_id::text, 8)
        else next_slug end,
      published_at = case when p_status = 'published' then coalesce(public.documents.published_at, now()) else null end,
      published_by = case when p_status = 'published' then auth.uid() else null end,
      updated_by = auth.uid()
  where id = p_document_id and deleted_at is null
  returning * into updated_document;
  if not found then raise exception 'Document was not found'; end if;

  select coalesce(max(version_number), 0) + 1 into next_version from public.document_versions where document_id = p_document_id;
  insert into public.document_versions (workspace_id, document_id, version_number, title, content_md, status, visibility, public_slug, created_by)
  values (updated_document.workspace_id, updated_document.id, next_version, updated_document.title, updated_document.content_md, updated_document.status, updated_document.visibility, updated_document.public_slug, auth.uid());
  perform public.record_audit_event(updated_document.workspace_id, 'document.version_created', 'document', updated_document.id, jsonb_build_object('version', next_version, 'status', updated_document.status));
  return updated_document;
end;
$$;

create or replace function public.restore_document_version(target_version_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  source_version public.document_versions;
  restored_document public.documents;
  next_version integer;
begin
  select * into source_version from public.document_versions where id = target_version_id;
  if not found or not public.can_edit_document(source_version.document_id) then
    raise exception 'You do not have permission to restore this version';
  end if;
  update public.documents
  set title = source_version.title,
      content_md = source_version.content_md,
      status = source_version.status,
      visibility = source_version.visibility,
      published_title = case when source_version.status = 'published' then source_version.title else public.documents.published_title end,
      published_content_md = case when source_version.status = 'published' then source_version.content_md else public.documents.published_content_md end,
      public_slug = source_version.public_slug,
      published_at = case when source_version.status = 'published' then now() else null end,
      published_by = case when source_version.status = 'published' then auth.uid() else null end,
      updated_by = auth.uid()
  where id = source_version.document_id and deleted_at is null
  returning * into restored_document;
  select coalesce(max(version_number), 0) + 1 into next_version from public.document_versions where document_id = restored_document.id;
  insert into public.document_versions (workspace_id, document_id, version_number, title, content_md, status, visibility, public_slug, created_by, restored_from_id)
  values (restored_document.workspace_id, restored_document.id, next_version, restored_document.title, restored_document.content_md, restored_document.status, restored_document.visibility, restored_document.public_slug, auth.uid(), source_version.id);
  perform public.record_audit_event(restored_document.workspace_id, 'document.version_restored', 'document', restored_document.id, jsonb_build_object('restored_version', source_version.version_number, 'new_version', next_version));
  return restored_document;
end;
$$;

create or replace function public.get_public_document(public_slug_input text)
returns table (id uuid, title text, content_md text, published_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select document_record.id,
    coalesce(document_record.published_title, document_record.title),
    document_record.published_content_md,
    document_record.published_at,
    document_record.updated_at
  from public.documents document_record
  where document_record.public_slug = public_slug_input
    and document_record.visibility = 'public'
    and document_record.status = 'published'
    and document_record.published_content_md is not null
    and document_record.deleted_at is null;
$$;

create or replace function public.seed_docs_for_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  welcome_folder uuid;
  welcome_document public.documents;
begin
  insert into public.document_folders (workspace_id, name, created_by, updated_by)
  values (new.id, 'Welcome', new.owner_id, new.owner_id)
  on conflict do nothing
  returning id into welcome_folder;
  if welcome_folder is null then
    select id into welcome_folder from public.document_folders where workspace_id = new.id and parent_id is null and name = 'Welcome' and deleted_at is null limit 1;
  end if;
  insert into public.documents (workspace_id, folder_id, title, content_md, status, visibility, published_title, published_content_md, published_at, published_by, created_by, updated_by)
  values (new.id, welcome_folder, 'Welcome to Elyqora Docs', E'# Welcome to Elyqora Docs\n\nThis is your workspace writing room. Use Markdown, save drafts safely, and publish only what you want to share.', 'published', 'workspace', 'Welcome to Elyqora Docs', E'# Welcome to Elyqora Docs\n\nThis is your workspace writing room. Use Markdown, save drafts safely, and publish only what you want to share.', now(), new.owner_id, new.owner_id, new.owner_id)
  returning * into welcome_document;
  insert into public.document_versions (workspace_id, document_id, version_number, title, content_md, status, visibility, created_by)
  values (new.id, welcome_document.id, 1, welcome_document.title, welcome_document.content_md, welcome_document.status, welcome_document.visibility, new.owner_id);
  return new;
end;
$$;

drop trigger if exists workspaces_seed_docs on public.workspaces;
create trigger workspaces_seed_docs after insert on public.workspaces
  for each row execute procedure public.seed_docs_for_workspace();

insert into public.permissions (key, label, description)
values
  ('docs.read', 'Read Docs', 'View permitted workspace documents.'),
  ('docs.write', 'Write Docs', 'Create and edit workspace documents.'),
  ('docs.manage', 'Manage Docs', 'Manage document sharing, folders, and publishing.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id from public.roles cross join public.permissions
where roles.name in ('owner', 'admin') and permissions.key in ('docs.read', 'docs.write', 'docs.manage')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id from public.roles cross join public.permissions
where roles.name = 'member' and permissions.key in ('docs.read', 'docs.write')
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id from public.roles cross join public.permissions
where roles.name = 'viewer' and permissions.key = 'docs.read'
on conflict do nothing;

alter table public.document_folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_tags enable row level security;
alter table public.document_tag_links enable row level security;
alter table public.document_comments enable row level security;
alter table public.document_mentions enable row level security;
alter table public.document_links enable row level security;
alter table public.document_favorites enable row level security;
alter table public.document_shares enable row level security;

drop policy if exists document_folders_member_read on public.document_folders;
create policy document_folders_member_read on public.document_folders for select using (deleted_at is null and public.is_workspace_member(workspace_id));
drop policy if exists document_folders_writer_insert on public.document_folders;
create policy document_folders_writer_insert on public.document_folders for insert with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and public.has_workspace_permission(workspace_id, 'docs.write')
  and (parent_id is null or public.document_folder_workspace_id(parent_id) = workspace_id)
);
drop policy if exists document_folders_manager_update on public.document_folders;
create policy document_folders_manager_update on public.document_folders for update using (created_by = auth.uid() or public.has_workspace_permission(workspace_id, 'docs.manage')) with check (
  public.is_workspace_member(workspace_id)
  and (parent_id is null or public.document_folder_workspace_id(parent_id) = workspace_id)
);
drop policy if exists document_folders_manager_delete on public.document_folders;
create policy document_folders_manager_delete on public.document_folders for delete using (public.has_workspace_permission(workspace_id, 'docs.manage'));

drop policy if exists documents_reader_select on public.documents;
create policy documents_reader_select on public.documents for select using (
  (deleted_at is null and public.can_read_document(id))
  or (deleted_at is not null and (created_by = auth.uid() or public.has_workspace_permission(workspace_id, 'docs.manage')))
);
drop policy if exists documents_writer_insert on public.documents;
create policy documents_writer_insert on public.documents for insert with check (
  created_by = auth.uid()
  and updated_by = auth.uid()
  and public.has_workspace_permission(workspace_id, 'docs.write')
  and (folder_id is null or public.document_folder_workspace_id(folder_id) = workspace_id)
);
drop policy if exists documents_editor_update on public.documents;
create policy documents_editor_update on public.documents for update using (public.can_edit_document(id)) with check (
  public.is_workspace_member(workspace_id)
  and workspace_id = public.document_workspace_id(id)
  and (folder_id is null or public.document_folder_workspace_id(folder_id) = workspace_id)
);
drop policy if exists documents_editor_delete on public.documents;
create policy documents_editor_delete on public.documents for delete using (public.can_edit_document(id));

drop policy if exists document_versions_reader_select on public.document_versions;
create policy document_versions_reader_select on public.document_versions for select using (public.can_read_document(document_id));
drop policy if exists document_versions_editor_insert on public.document_versions;
create policy document_versions_editor_insert on public.document_versions for insert with check (
  created_by = auth.uid()
  and public.can_edit_document(document_id)
  and workspace_id = public.document_workspace_id(document_id)
);

drop policy if exists document_tags_member_read on public.document_tags;
create policy document_tags_member_read on public.document_tags for select using (public.is_workspace_member(workspace_id));
drop policy if exists document_tags_writer_insert on public.document_tags;
create policy document_tags_writer_insert on public.document_tags for insert with check (created_by = auth.uid() and public.has_workspace_permission(workspace_id, 'docs.write'));
drop policy if exists document_tags_manager_update on public.document_tags;
create policy document_tags_manager_update on public.document_tags for update using (public.has_workspace_permission(workspace_id, 'docs.manage')) with check (public.is_workspace_member(workspace_id));
drop policy if exists document_tags_manager_delete on public.document_tags;
create policy document_tags_manager_delete on public.document_tags for delete using (public.has_workspace_permission(workspace_id, 'docs.manage'));

drop policy if exists document_tag_links_reader_select on public.document_tag_links;
create policy document_tag_links_reader_select on public.document_tag_links for select using (public.can_read_document(document_id));
drop policy if exists document_tag_links_editor_insert on public.document_tag_links;
create policy document_tag_links_editor_insert on public.document_tag_links for insert with check (
  created_by = auth.uid()
  and public.can_edit_document(document_id)
  and workspace_id = public.document_workspace_id(document_id)
  and public.document_tag_workspace_id(tag_id) = workspace_id
);
drop policy if exists document_tag_links_editor_delete on public.document_tag_links;
create policy document_tag_links_editor_delete on public.document_tag_links for delete using (public.can_edit_document(document_id));

drop policy if exists document_comments_reader_select on public.document_comments;
create policy document_comments_reader_select on public.document_comments for select using (public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_comments_reader_insert on public.document_comments;
create policy document_comments_reader_insert on public.document_comments for insert with check (author_id = auth.uid() and public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_comments_author_update on public.document_comments;
create policy document_comments_author_update on public.document_comments for update using (author_id = auth.uid() or public.has_workspace_permission(workspace_id, 'docs.manage')) with check (
  (author_id = auth.uid() or public.has_workspace_permission(workspace_id, 'docs.manage'))
  and public.can_read_document(document_id)
  and workspace_id = public.document_workspace_id(document_id)
);
drop policy if exists document_comments_author_delete on public.document_comments;
create policy document_comments_author_delete on public.document_comments for delete using (author_id = auth.uid() or public.has_workspace_permission(workspace_id, 'docs.manage'));

drop policy if exists document_mentions_reader_select on public.document_mentions;
create policy document_mentions_reader_select on public.document_mentions for select using (public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_mentions_reader_insert on public.document_mentions;
create policy document_mentions_reader_insert on public.document_mentions for insert with check (created_by = auth.uid() and public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));

drop policy if exists document_links_reader_select on public.document_links;
create policy document_links_reader_select on public.document_links for select using (public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_links_editor_insert on public.document_links;
create policy document_links_editor_insert on public.document_links for insert with check (created_by = auth.uid() and public.can_edit_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_links_editor_delete on public.document_links;
create policy document_links_editor_delete on public.document_links for delete using (public.can_edit_document(document_id));

drop policy if exists document_favorites_owner_read on public.document_favorites;
create policy document_favorites_owner_read on public.document_favorites for select using (user_id = auth.uid() and public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_favorites_owner_insert on public.document_favorites;
create policy document_favorites_owner_insert on public.document_favorites for insert with check (user_id = auth.uid() and public.can_read_document(document_id) and workspace_id = public.document_workspace_id(document_id));
drop policy if exists document_favorites_owner_delete on public.document_favorites;
create policy document_favorites_owner_delete on public.document_favorites for delete using (user_id = auth.uid());

drop policy if exists document_shares_reader_select on public.document_shares;
create policy document_shares_reader_select on public.document_shares for select using (public.can_read_document(document_id) or public.can_edit_document(document_id));
drop policy if exists document_shares_editor_insert on public.document_shares;
create policy document_shares_editor_insert on public.document_shares for insert with check (
  created_by = auth.uid()
  and public.can_edit_document(document_id)
  and workspace_id = public.document_workspace_id(document_id)
  and exists (
    select 1 from public.memberships member_record
    where member_record.workspace_id = document_shares.workspace_id
      and member_record.user_id = document_shares.user_id
      and member_record.status = 'active'
  )
);
drop policy if exists document_shares_editor_update on public.document_shares;
create policy document_shares_editor_update on public.document_shares for update using (public.can_edit_document(document_id)) with check (
  public.can_edit_document(document_id)
  and workspace_id = public.document_workspace_id(document_id)
  and exists (
    select 1 from public.memberships member_record
    where member_record.workspace_id = document_shares.workspace_id
      and member_record.user_id = document_shares.user_id
      and member_record.status = 'active'
  )
);
drop policy if exists document_shares_editor_delete on public.document_shares;
create policy document_shares_editor_delete on public.document_shares for delete using (public.can_edit_document(document_id));

grant select, insert, update, delete on public.document_folders to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert on public.document_versions to authenticated;
grant select, insert, update, delete on public.document_tags to authenticated;
grant select, insert, delete on public.document_tag_links to authenticated;
grant select, insert, update, delete on public.document_comments to authenticated;
grant select, insert on public.document_mentions to authenticated;
grant select, insert, delete on public.document_links to authenticated;
grant select, insert, delete on public.document_favorites to authenticated;
grant select, insert, update, delete on public.document_shares to authenticated;
grant execute on function public.can_read_document(uuid) to authenticated;
grant execute on function public.can_edit_document(uuid) to authenticated;
grant execute on function public.document_workspace_id(uuid) to authenticated;
grant execute on function public.document_folder_workspace_id(uuid) to authenticated;
grant execute on function public.document_tag_workspace_id(uuid) to authenticated;
grant execute on function public.create_document_for_current_user(uuid, uuid, text) to authenticated;
grant execute on function public.save_document_draft(uuid, text, text) to authenticated;
grant execute on function public.save_document_version(uuid, text, text, text, text) to authenticated;
grant execute on function public.restore_document_version(uuid) to authenticated;
grant execute on function public.get_public_document(text) to anon, authenticated;
