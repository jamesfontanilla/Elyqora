import type { PermissionKey, RoleName } from "@/lib/types";

export const ROLE_PERMISSIONS: Record<RoleName, readonly PermissionKey[]> = {
  owner: ["workspace.read", "workspace.update", "workspace.delete", "members.read", "members.manage", "audit.read", "modules.read", "profile.update", "drive.read", "drive.write", "drive.manage"],
  admin: ["workspace.read", "workspace.update", "members.read", "members.manage", "audit.read", "modules.read", "profile.update", "drive.read", "drive.write", "drive.manage"],
  member: ["workspace.read", "members.read", "modules.read", "profile.update", "drive.read", "drive.write"],
  viewer: ["workspace.read", "members.read", "modules.read", "drive.read"],
};

export function hasLocalPermission(role: RoleName, permission: PermissionKey) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canManageMembers(role: RoleName) {
  return hasLocalPermission(role, "members.manage");
}
