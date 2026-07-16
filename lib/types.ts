export type WorkspaceType = "personal" | "team" | "nonprofit" | "education" | "operations";
export type RoleName = "owner" | "admin" | "member" | "viewer";
export type MembershipStatus = "invited" | "active" | "suspended" | "removed";

export type PermissionKey =
  | "workspace.read"
  | "workspace.update"
  | "workspace.delete"
  | "members.read"
  | "members.manage"
  | "audit.read"
  | "modules.read"
  | "profile.update"
  | "drive.read"
  | "drive.write"
  | "drive.manage"
  | "docs.read"
  | "docs.write"
  | "docs.manage"
  | "notes.read"
  | "notes.write"
  | "notes.manage"
  | "tasks.read"
  | "tasks.write"
  | "tasks.manage"
  | "tables.read"
  | "tables.write"
  | "tables.manage";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  workspace_type: WorkspaceType;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Role {
  id: string;
  name: RoleName;
  label: string;
  description: string;
}

export interface Membership {
  id: string;
  workspace_id: string;
  user_id: string;
  role_id: string;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  role?: Pick<Role, "id" | "name" | "label"> | null;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string | null;
  token_preview: string;
  role_id: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string;
  expires_at: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ModuleDefinition {
  name: string;
  slug: string;
  icon: string;
  description: string;
  navigation: "primary" | "workspace" | "settings";
  requiredPermission: PermissionKey;
  enabled: boolean;
}

export interface RecentItem {
  id: string;
  workspace_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  label: string;
  href: string;
  icon: string;
  open_count: number;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
}

export interface PinnedModule {
  id: string;
  workspace_id: string;
  user_id: string;
  module_slug: string;
  position: number;
}

export interface DashboardPreferences {
  id?: string;
  workspace_id: string;
  user_id: string;
  quick_actions: string[];
  layout: Record<string, unknown>;
  show_recent: boolean;
  show_notifications: boolean;
}

export interface NotificationItem {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  body: string;
  kind: "info" | "success" | "warning" | "mention";
  href: string | null;
  source_type?: string | null;
  source_id?: string | null;
  dedupe_key?: string | null;
  metadata?: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type DriveUploadStatus = "pending" | "ready" | "failed";
export type DriveAccessLevel = "workspace" | "restricted";
export type DriveSharePermission = "read" | "edit";
export type DriveAttachmentTarget = "docs" | "notes" | "tasks" | "expenses" | "projects" | "helpdesk" | "contacts";

export interface DriveStorageSettings {
  workspace_id: string;
  max_file_size_bytes: number;
  quota_bytes: number;
  allowed_mime_types: string[];
  created_at: string;
  updated_at: string;
}

export interface DriveFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DriveFile {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  upload_status: DriveUploadStatus;
  access_level: DriveAccessLevel;
  created_by: string;
  updated_by: string;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DriveFileShare {
  id: string;
  workspace_id: string;
  file_id: string;
  user_id: string;
  permission: DriveSharePermission;
  created_by: string;
  created_at: string;
  updated_at: string;
  profile?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface DriveFavorite {
  id: string;
  workspace_id: string;
  file_id: string;
  user_id: string;
  created_at: string;
}

export interface DriveAttachment {
  id: string;
  workspace_id: string;
  file_id: string;
  target_type: DriveAttachmentTarget;
  target_id: string;
  created_by: string;
  created_at: string;
}

export type DocumentStatus = "draft" | "published";
export type DocumentVisibility = "private" | "workspace" | "public";
export type DocumentSharePermission = "read" | "edit";
export type DocumentLinkTarget = "project" | "task" | "contact" | "ticket" | "event" | "course";

export interface DocumentFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentRecord {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  public_slug: string | null;
  content_md: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  published_at: string | null;
  published_by: string | null;
  published_title: string | null;
  published_content_md: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentVersion {
  id: string;
  workspace_id: string;
  document_id: string;
  version_number: number;
  title: string;
  content_md: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  public_slug: string | null;
  created_by: string;
  restored_from_id: string | null;
  created_at: string;
}

export interface DocumentTag {
  id: string;
  workspace_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface DocumentComment {
  id: string;
  workspace_id: string;
  document_id: string;
  author_id: string;
  body: string;
  line_number: number | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface DocumentLink {
  id: string;
  workspace_id: string;
  document_id: string;
  target_type: DocumentLinkTarget;
  target_id: string;
  created_by: string;
  created_at: string;
}

export type NoteScope = "personal" | "workspace";
export type NoteVisibility = "private" | "workspace";
export type NoteColor = "sand" | "mint" | "coral" | "sky" | "amber" | "plum";
export type NoteLinkTarget = DocumentLinkTarget;
export type NoteReminderStatus = "scheduled" | "dismissed" | "triggered";

export interface NoteChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NoteRecord {
  id: string;
  workspace_id: string;
  title: string;
  body_md: string;
  checklist_items: NoteChecklistItem[];
  scope: NoteScope;
  visibility: NoteVisibility;
  color: NoteColor;
  pinned: boolean;
  archived_at: string | null;
  archived_by: string | null;
  revision: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface NoteLabel {
  id: string;
  workspace_id: string;
  note_id: string;
  label: string;
  created_by: string;
  created_at: string;
}

export interface NoteLink {
  id: string;
  workspace_id: string;
  note_id: string;
  target_type: NoteLinkTarget;
  target_id: string;
  created_by: string;
  created_at: string;
}

export interface NoteReminder {
  id: string;
  workspace_id: string;
  note_id: string;
  remind_at: string;
  status: NoteReminderStatus;
  notification_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  note?: Pick<NoteRecord, "id" | "title" | "color" | "scope" | "visibility" | "pinned" | "archived_at"> | null;
  notification?: Pick<NotificationItem, "id" | "title" | "body" | "kind" | "href" | "read_at" | "created_at"> | null;
}

export interface NoteAttachment {
  id: string;
  workspace_id: string;
  note_id: string;
  file_id: string;
  created_by: string;
  created_at: string;
  file?: Pick<DriveFile, "id" | "name" | "mime_type" | "size_bytes" | "upload_status"> | null;
}

export type TaskScope = "personal" | "workspace";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "completed" | "canceled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type TaskLinkTarget = DocumentLinkTarget | "goal";

export interface TaskRecurrenceRule {
  frequency: TaskRecurrenceFrequency;
  interval: number;
  weekdays?: number[];
  day_of_month?: number | null;
  end_date?: string | null;
}

export interface TaskRecord {
  id: string;
  workspace_id: string;
  parent_task_id: string | null;
  series_id: string;
  recurrence_rule: TaskRecurrenceRule | null;
  recurrence_occurrence: number;
  title: string;
  description_md: string;
  status: TaskStatus;
  priority: TaskPriority;
  scope: TaskScope;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  revision: number;
  search_document?: string | null;
  creator?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  assignee?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface TaskLabel {
  id: string;
  workspace_id: string;
  task_id: string;
  label: string;
  created_by: string;
  created_at: string;
}

export interface TaskDependency {
  id: string;
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
  created_by: string;
  created_at: string;
  blocking_task?: Pick<TaskRecord, "id" | "title" | "status" | "priority" | "due_date" | "assignee_id"> | null;
}

export interface TaskComment {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface TaskLink {
  id: string;
  workspace_id: string;
  task_id: string;
  target_type: TaskLinkTarget;
  target_id: string;
  created_by: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  workspace_id: string;
  task_id: string;
  file_id: string;
  created_by: string;
  created_at: string;
  file?: Pick<DriveFile, "id" | "name" | "mime_type" | "size_bytes" | "upload_status"> | null;
}

export type TableColumnType = "text" | "long_text" | "number" | "currency" | "boolean" | "date" | "single_select" | "multi_select" | "url" | "user_reference";
export type TableFilterOperator = "contains" | "equals" | "not_equals" | "is_empty" | "not_empty" | "greater_than" | "less_than" | "before" | "after";
export type TableSortDirection = "asc" | "desc";

export interface TableColumnSettings {
  options?: string[];
  precision?: number;
  currency_code?: string;
}

export interface WorkspaceTable {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TableColumn {
  id: string;
  workspace_id: string;
  table_id: string;
  name: string;
  column_key: string;
  column_type: TableColumnType;
  position: number;
  is_hidden: boolean;
  is_required: boolean;
  settings: TableColumnSettings;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface TableRow {
  id: string;
  workspace_id: string;
  table_id: string;
  row_order: number;
  cell_values: Record<string, unknown>;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface TableView {
  id: string;
  workspace_id: string;
  table_id: string;
  name: string;
  is_default: boolean;
  filter_rules: TableFilterRule[];
  sort_rules: TableSortRule[];
  hidden_column_ids: string[];
  column_order: string[];
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface TableFilterRule {
  column_id: string;
  operator: TableFilterOperator;
  value: string | number | boolean | null | string[];
}

export interface TableSortRule {
  column_id: string;
  direction: TableSortDirection;
}

export interface TableRowComment {
  id: string;
  workspace_id: string;
  table_id: string;
  row_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface TableRowActivity {
  id: string;
  workspace_id: string;
  table_id: string;
  row_id: string;
  actor_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}
