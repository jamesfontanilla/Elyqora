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
  | "docs.manage";

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
  read_at: string | null;
  created_at: string;
}

export type DriveUploadStatus = "pending" | "ready" | "failed";
export type DriveAccessLevel = "workspace" | "restricted";
export type DriveSharePermission = "read" | "edit";
export type DriveAttachmentTarget = "docs" | "expenses" | "projects" | "helpdesk" | "contacts";

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
