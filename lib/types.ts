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
  | "profile.update";

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
