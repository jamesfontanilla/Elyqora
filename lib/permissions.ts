import type { PermissionKey, RoleName } from "@/lib/types";

export const ROLE_PERMISSIONS: Record<RoleName, readonly PermissionKey[]> = {
  owner: ["workspace.read", "workspace.update", "workspace.delete", "members.read", "members.manage", "audit.read", "modules.read", "profile.update", "drive.read", "drive.write", "drive.manage", "docs.read", "docs.write", "docs.manage", "notes.read", "notes.write", "notes.manage", "tasks.read", "tasks.write", "tasks.manage", "tables.read", "tables.write", "tables.manage"],
  admin: ["workspace.read", "workspace.update", "members.read", "members.manage", "audit.read", "modules.read", "profile.update", "drive.read", "drive.write", "drive.manage", "docs.read", "docs.write", "docs.manage", "notes.read", "notes.write", "notes.manage", "tasks.read", "tasks.write", "tasks.manage", "tables.read", "tables.write", "tables.manage"],
  member: ["workspace.read", "members.read", "modules.read", "profile.update", "drive.read", "drive.write", "docs.read", "docs.write", "notes.read", "notes.write", "tasks.read", "tasks.write", "tables.read", "tables.write"],
  viewer: ["workspace.read", "members.read", "modules.read", "drive.read", "docs.read", "notes.read", "tasks.read", "tables.read"],
};

export function hasLocalPermission(role: RoleName, permission: PermissionKey) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canManageMembers(role: RoleName) {
  return hasLocalPermission(role, "members.manage");
}
