"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { requireUser, requireWorkspacePermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_ALLOWED_MIME_TYPES, DRIVE_ATTACHMENT_TARGETS } from "@/lib/drive/constants";
import type { DriveAttachmentTarget } from "@/lib/types";

const uuid = z.string().uuid();
const fileName = z.string().trim().min(1).max(160).refine((value) => !/[\\/]/.test(value), "File names cannot contain slashes.");

async function editableFile(workspaceId: string, fileId: string) {
  const supabase = await createClient();
  const { data: file } = await supabase.from("drive_files").select("*").eq("id", fileId).eq("workspace_id", workspaceId).maybeSingle();
  if (!file) throw new Error("File not found or no longer available.");
  const { data: canEdit, error } = await supabase.rpc("can_edit_drive_file", { target_file_id: fileId });
  if (error || !canEdit) throw new Error("You do not have permission to change this file.");
  return { supabase, file };
}

async function audit(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await supabase.rpc("record_audit_event", {
    target_workspace_id: workspaceId,
    event_action: action,
    event_entity_type: entityType,
    event_entity_id: entityId,
    event_metadata: metadata,
  });
}

export async function createDriveFolderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const parentValue = String(formData.get("parentId") ?? "");
  const parentId = parentValue ? uuid.safeParse(parentValue) : { success: true as const, data: null };
  const name = z.string().trim().min(1, "Enter a folder name.").max(120).refine((value) => !/[\\/]/.test(value), "Folder names cannot contain slashes.").safeParse(formData.get("name"));
  if (!workspaceId.success || !parentId.success || !name.success) return { error: name.success ? "Select a valid folder." : name.error.issues[0]?.message };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: canWrite } = await supabase.rpc("has_workspace_permission", { target_workspace_id: workspaceId.data, required_permission: "drive.write" });
    if (!canWrite) return { error: "You do not have permission to create folders." };
    if (parentId.data) {
      const { data: parent } = await supabase.from("drive_folders").select("id").eq("id", parentId.data).eq("workspace_id", workspaceId.data).is("deleted_at", null).maybeSingle();
      if (!parent) return { error: "That parent folder is not available." };
    }
    const { data, error } = await supabase.from("drive_folders").insert({ workspace_id: workspaceId.data, parent_id: parentId.data, name: name.data, created_by: user.id, updated_by: user.id }).select("id").single();
    if (error) return { error: error.code === "23505" ? "A folder with that name already exists here." : error.message };
    await audit(supabase, workspaceId.data, "drive.folder.created", "drive_folder", data.id, { name: name.data, parent_id: parentId.data });
    revalidatePath("/files");
    return { message: "Folder created." };
  } catch (error) {
    return actionError(error);
  }
}

export async function renameDriveFolderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const folderId = uuid.safeParse(formData.get("folderId"));
  const name = z.string().trim().min(1).max(120).refine((value) => !/[\\/]/.test(value), "Folder names cannot contain slashes.").safeParse(formData.get("name"));
  if (!workspaceId.success || !folderId.success || !name.success) return { error: "Enter a valid folder name." };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: folder } = await supabase.from("drive_folders").select("id,parent_id").eq("id", folderId.data).eq("workspace_id", workspaceId.data).is("deleted_at", null).maybeSingle();
    if (!folder) return { error: "Folder not found." };
    const { data: canWrite } = await supabase.rpc("has_workspace_permission", { target_workspace_id: workspaceId.data, required_permission: "drive.write" });
    if (!canWrite) return { error: "You do not have permission to rename folders." };
    const { error } = await supabase.from("drive_folders").update({ name: name.data, updated_by: user.id }).eq("id", folderId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.code === "23505" ? "A folder with that name already exists here." : error.message };
    await audit(supabase, workspaceId.data, "drive.folder.renamed", "drive_folder", folderId.data, { name: name.data });
    revalidatePath("/files");
    return { message: "Folder renamed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteDriveFolderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const folderId = uuid.safeParse(formData.get("folderId"));
  if (!workspaceId.success || !folderId.success) return { error: "Select a valid folder." };
  try {
    const { user } = await requireWorkspacePermission(workspaceId.data, "drive.manage");
    const supabase = await createClient();
    const [{ count: fileCount }, { count: folderCount }] = await Promise.all([
      supabase.from("drive_files").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId.data).eq("folder_id", folderId.data).is("deleted_at", null),
      supabase.from("drive_folders").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId.data).eq("parent_id", folderId.data).is("deleted_at", null),
    ]);
    if ((fileCount ?? 0) > 0 || (folderCount ?? 0) > 0) return { error: "Move the folder contents before deleting this folder." };
    const { error } = await supabase.from("drive_folders").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", folderId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.folder.deleted", "drive_folder", folderId.data);
    revalidatePath("/files");
    return { message: "Folder deleted." };
  } catch (error) {
    return actionError(error);
  }
}

export async function renameDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const name = fileName.safeParse(formData.get("name"));
  if (!workspaceId.success || !fileId.success || !name.success) return { error: name.success ? "Select a valid file." : name.error.issues[0]?.message };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_files").update({ name: name.data, updated_by: user.id }).eq("id", fileId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.renamed", "drive_file", fileId.data, { name: name.data });
    revalidatePath("/files");
    return { message: "File renamed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const folderValue = String(formData.get("folderId") ?? "");
  const folderId = folderValue ? uuid.safeParse(folderValue) : { success: true as const, data: null };
  if (!workspaceId.success || !fileId.success || !folderId.success) return { error: "Select a valid destination." };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    if (folderId.data) {
      const { data: folder } = await supabase.from("drive_folders").select("id").eq("id", folderId.data).eq("workspace_id", workspaceId.data).is("deleted_at", null).maybeSingle();
      if (!folder) return { error: "That destination folder is not available." };
    }
    const { error } = await supabase.from("drive_files").update({ folder_id: folderId.data, updated_by: user.id }).eq("id", fileId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.moved", "drive_file", fileId.data, { folder_id: folderId.data });
    revalidatePath("/files");
    return { message: "File moved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setDriveFileAccessAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const accessLevel = z.enum(["workspace", "restricted"]).safeParse(formData.get("accessLevel"));
  if (!workspaceId.success || !fileId.success || !accessLevel.success) return { error: "Select a valid access level." };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_files").update({ access_level: accessLevel.data, updated_by: user.id }).eq("id", fileId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.access_changed", "drive_file", fileId.data, { access_level: accessLevel.data });
    revalidatePath("/files");
    return { message: accessLevel.data === "restricted" ? "File is now restricted." : "File is shared with workspace members." };
  } catch (error) {
    return actionError(error);
  }
}

export async function shareDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const userId = uuid.safeParse(formData.get("userId"));
  const permission = z.enum(["read", "edit"]).safeParse(formData.get("permission"));
  if (!workspaceId.success || !fileId.success || !userId.success || !permission.success) return { error: "Choose a workspace member and permission." };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { data: member } = await supabase.from("memberships").select("id").eq("workspace_id", workspaceId.data).eq("user_id", userId.data).eq("status", "active").maybeSingle();
    if (!member) return { error: "That person is not an active workspace member." };
    const { error } = await supabase.from("drive_file_shares").upsert({ workspace_id: workspaceId.data, file_id: fileId.data, user_id: userId.data, permission: permission.data, created_by: user.id }, { onConflict: "file_id,user_id" });
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.shared", "drive_file", fileId.data, { user_id: userId.data, permission: permission.data });
    revalidatePath("/files");
    return { message: "File share saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeDriveFileShareAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const userId = uuid.safeParse(formData.get("userId"));
  if (!workspaceId.success || !fileId.success || !userId.success) return { error: "Select a valid share." };
  try {
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_file_shares").delete().eq("workspace_id", workspaceId.data).eq("file_id", fileId.data).eq("user_id", userId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.share_removed", "drive_file", fileId.data, { user_id: userId.data });
    revalidatePath("/files");
    return { message: "File share removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleDriveFavoriteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const favorite = formData.get("favorite") === "true";
  if (!workspaceId.success || !fileId.success) return { error: "Select a valid file." };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: canRead } = await supabase.rpc("can_read_drive_file", { target_file_id: fileId.data });
    if (!canRead) return { error: "You cannot favorite this file." };
    if (favorite) {
      const { error } = await supabase.from("drive_favorites").upsert({ workspace_id: workspaceId.data, file_id: fileId.data, user_id: user.id }, { onConflict: "file_id,user_id" });
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("drive_favorites").delete().eq("workspace_id", workspaceId.data).eq("file_id", fileId.data).eq("user_id", user.id);
      if (error) return { error: error.message };
    }
    await audit(supabase, workspaceId.data, favorite ? "drive.file.favorite" : "drive.file.unfavorite", "drive_file", fileId.data);
    revalidatePath("/files");
    return { message: favorite ? "Added to favorites." : "Removed from favorites." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  if (!workspaceId.success || !fileId.success) return { error: "Select a valid file." };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_files").update({ deleted_at: new Date().toISOString(), deleted_by: user.id, updated_by: user.id }).eq("id", fileId.data).eq("workspace_id", workspaceId.data).is("deleted_at", null);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.deleted", "drive_file", fileId.data);
    revalidatePath("/files");
    return { message: "File moved to the recycle bin." };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  if (!workspaceId.success || !fileId.success) return { error: "Select a valid file." };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_files").update({ deleted_at: null, deleted_by: null, updated_by: user.id }).eq("id", fileId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.restored", "drive_file", fileId.data);
    revalidatePath("/files");
    return { message: "File restored." };
  } catch (error) {
    return actionError(error);
  }
}

export async function purgeDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  if (!workspaceId.success || !fileId.success) return { error: "Select a valid file." };
  try {
    await requireWorkspacePermission(workspaceId.data, "drive.manage");
    const { supabase, file } = await editableFile(workspaceId.data, fileId.data);
    if (!file.deleted_at) return { error: "Only deleted files can be purged." };
    const { error: storageError } = await supabase.storage.from("elyqora-drive").remove([file.storage_path]);
    if (storageError) return { error: `Storage cleanup failed: ${storageError.message}` };
    await audit(supabase, workspaceId.data, "drive.file.purged", "drive_file", fileId.data, { storage_path: file.storage_path });
    const { error } = await supabase.from("drive_files").delete().eq("id", fileId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    revalidatePath("/files");
    return { message: "File and storage object permanently removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDriveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const maxSizeMb = z.coerce.number().int().min(1).max(10).safeParse(formData.get("maxSizeMb"));
  const quotaMb = z.coerce.number().int().min(1).max(1024).safeParse(formData.get("quotaMb"));
  const allowed = formData.getAll("allowedMimeTypes").map(String);
  if (!workspaceId.success || !maxSizeMb.success || !quotaMb.success || allowed.length === 0 || allowed.some((mime) => !(DRIVE_ALLOWED_MIME_TYPES as readonly string[]).includes(mime))) return { error: "Choose valid Drive Lite limits and file types." };
  if (maxSizeMb.data > quotaMb.data) return { error: "The file-size limit cannot exceed the workspace quota." };
  try {
    await requireWorkspacePermission(workspaceId.data, "workspace.update");
    const supabase = await createClient();
    const { error } = await supabase.from("drive_storage_settings").upsert({ workspace_id: workspaceId.data, max_file_size_bytes: maxSizeMb.data * 1024 * 1024, quota_bytes: quotaMb.data * 1024 * 1024, allowed_mime_types: allowed }, { onConflict: "workspace_id" });
    if (error) return { error: error.message };
    revalidatePath("/files");
    return { message: "Drive Lite settings saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function attachDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const targetId = uuid.safeParse(formData.get("targetId"));
  const targetType = z.enum(DRIVE_ATTACHMENT_TARGETS.map((target) => target.value) as [DriveAttachmentTarget, ...DriveAttachmentTarget[]]).safeParse(formData.get("targetType"));
  if (!workspaceId.success || !fileId.success || !targetId.success || !targetType.success) return { error: "Choose a valid attachment target." };
  try {
    const user = await requireUser();
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_attachments").upsert({ workspace_id: workspaceId.data, file_id: fileId.data, target_type: targetType.data, target_id: targetId.data, created_by: user.id }, { onConflict: "file_id,target_type,target_id" });
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.attached", "drive_file", fileId.data, { target_type: targetType.data, target_id: targetId.data });
    revalidatePath("/files");
    return { message: "File attached." };
  } catch (error) {
    return actionError(error);
  }
}

export async function detachDriveFileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const fileId = uuid.safeParse(formData.get("fileId"));
  const targetId = uuid.safeParse(formData.get("targetId"));
  const targetType = z.string().safeParse(formData.get("targetType"));
  if (!workspaceId.success || !fileId.success || !targetId.success || !targetType.success) return { error: "Choose a valid attachment target." };
  try {
    const { supabase } = await editableFile(workspaceId.data, fileId.data);
    const { error } = await supabase.from("drive_attachments").delete().eq("workspace_id", workspaceId.data).eq("file_id", fileId.data).eq("target_type", targetType.data).eq("target_id", targetId.data);
    if (error) return { error: error.message };
    await audit(supabase, workspaceId.data, "drive.file.detached", "drive_file", fileId.data, { target_type: targetType.data, target_id: targetId.data });
    revalidatePath("/files");
    return { message: "File detached." };
  } catch (error) {
    return actionError(error);
  }
}

export async function recordDriveAccess(workspaceId: string, fileId: string, action: string) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await supabase.from("drive_file_access_records").insert({ workspace_id: workspaceId, file_id: fileId, actor_id: user.id, action, metadata: {} });
  } catch {
    // Access telemetry must never block a file read.
  }
}
