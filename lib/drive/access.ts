import type { DriveAccessLevel, DriveSharePermission } from "@/lib/types";

export function canReadDriveRecord({
  userId,
  workspaceId,
  recordWorkspaceId,
  createdBy,
  accessLevel,
  sharePermission,
  deleted = false,
  uploadStatus = "ready",
}: {
  userId: string;
  workspaceId: string;
  recordWorkspaceId: string;
  createdBy: string;
  accessLevel: DriveAccessLevel;
  sharePermission?: DriveSharePermission | null;
  deleted?: boolean;
  uploadStatus?: string;
}) {
  if (deleted || uploadStatus !== "ready" || workspaceId !== recordWorkspaceId) return false;
  return accessLevel === "workspace" || createdBy === userId || sharePermission === "read" || sharePermission === "edit";
}

export function isDriveAttachmentTarget(value: string) {
  return ["docs", "notes", "expenses", "projects", "helpdesk", "contacts"].includes(value);
}
