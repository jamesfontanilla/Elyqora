import { getWorkspaceMembers } from "@/lib/workspaces/current";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_DEFAULT_QUOTA_BYTES, DRIVE_IMAGE_MIME_TYPES, DRIVE_TEXT_MIME_TYPES } from "@/lib/drive/constants";
import type { DriveFile, DriveFolder, DriveStorageSettings } from "@/lib/types";

export const DEFAULT_DRIVE_SETTINGS: Omit<DriveStorageSettings, "workspace_id" | "created_at" | "updated_at"> = {
  max_file_size_bytes: 10 * 1024 * 1024,
  quota_bytes: DRIVE_DEFAULT_QUOTA_BYTES,
  allowed_mime_types: [
    "text/plain", "text/csv", "text/markdown", "application/json", "application/pdf",
    "image/png", "image/jpeg", "image/gif", "image/webp",
  ],
};

export interface DriveBreadcrumb {
  id: string | null;
  name: string;
}

export interface DriveData {
  settings: DriveStorageSettings;
  folders: DriveFolder[];
  files: DriveFile[];
  favoriteIds: string[];
  recentFiles: DriveFile[];
  totalFiles: number;
  usageBytes: number;
  breadcrumbs: DriveBreadcrumb[];
  moveFolders: DriveFolder[];
}

export async function getDriveStorageSettings(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("drive_storage_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  return (data as DriveStorageSettings | null) ?? {
    workspace_id: workspaceId,
    ...DEFAULT_DRIVE_SETTINGS,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export async function getDriveData({
  userId,
  workspaceId,
  folderId,
  search,
  page,
  pageSize = 24,
  includeDeleted = false,
}: {
  userId: string;
  workspaceId: string;
  folderId: string | null;
  search: string;
  page: number;
  pageSize?: number;
  includeDeleted?: boolean;
}): Promise<DriveData> {
  const supabase = await createClient();
  const offset = Math.max(0, page - 1) * pageSize;
  const settingsPromise = getDriveStorageSettings(workspaceId);
  const folderPromise = supabase.from("drive_folders").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).eq("parent_id", folderId).order("name").range(0, 99);
  let fileQuery = supabase
    .from("drive_files")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("upload_status", "ready")
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  fileQuery = folderId ? fileQuery.eq("folder_id", folderId) : fileQuery.is("folder_id", null);
  fileQuery = includeDeleted ? fileQuery.not("deleted_at", "is", null) : fileQuery.is("deleted_at", null);
  if (search) fileQuery = fileQuery.ilike("name", `%${search.replace(/[%_]/g, "\\$&").slice(0, 80)}%`);

  const [settings, foldersResult, filesResult, usageResult, recentAccessResult, breadcrumbs, moveFolders] = await Promise.all([
    settingsPromise,
    folderPromise,
    fileQuery,
    supabase.rpc("get_drive_storage_usage", { target_workspace_id: workspaceId }),
    supabase.from("drive_file_access_records").select("file_id").eq("workspace_id", workspaceId).eq("actor_id", userId).order("created_at", { ascending: false }).range(0, 11),
    getDriveBreadcrumbs(folderId),
    getDriveMoveFolders(workspaceId),
  ]);
  const files = (filesResult.data ?? []) as DriveFile[];
  const favoriteIds = includeDeleted || files.length === 0
    ? []
    : ((await supabase.from("drive_favorites").select("file_id").eq("workspace_id", workspaceId).in("file_id", files.map((file) => file.id))).data ?? []).map((row) => row.file_id);
  const recentFileIds = [...new Set((recentAccessResult.data ?? []).map((row) => row.file_id))].slice(0, 8);
  const recentFiles = recentFileIds.length === 0 || includeDeleted
    ? []
    : ((await supabase.from("drive_files").select("*").in("id", recentFileIds).eq("upload_status", "ready").is("deleted_at", null)).data ?? []) as DriveFile[];
  const recentFileOrder = new Map(recentFileIds.map((id, index) => [id, index]));
  recentFiles.sort((left, right) => (recentFileOrder.get(left.id) ?? 0) - (recentFileOrder.get(right.id) ?? 0));

  return {
    settings,
    folders: (foldersResult.data ?? []) as DriveFolder[],
    files,
    favoriteIds,
    recentFiles,
    totalFiles: filesResult.count ?? 0,
    usageBytes: Number(usageResult.data ?? 0),
    breadcrumbs,
    moveFolders: (moveFolders ?? []) as DriveFolder[],
  };
}

export async function getDriveBreadcrumbs(folderId: string | null): Promise<DriveBreadcrumb[]> {
  const breadcrumbs: DriveBreadcrumb[] = [{ id: null, name: "All files" }];
  if (!folderId) return breadcrumbs;
  const supabase = await createClient();
  let currentId: string | null = folderId;
  const nested: DriveBreadcrumb[] = [];
  for (let index = 0; index < 20 && currentId; index += 1) {
    const result = await supabase.from("drive_folders").select("id,name,parent_id").eq("id", currentId).is("deleted_at", null).maybeSingle();
    const data = result.data as { id: string; name: string; parent_id: string | null } | null;
    if (!data) break;
    nested.unshift({ id: data.id, name: data.name });
    currentId = data.parent_id;
  }
  return breadcrumbs.concat(nested);
}

export async function getDriveMoveFolders(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("drive_folders").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).order("name").range(0, 199);
  return data ?? [];
}

export async function getDriveWorkspaceMembers(workspaceId: string) {
  return getWorkspaceMembers(workspaceId);
}

export async function getDriveFileForUser(fileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("drive_files").select("*").eq("id", fileId).maybeSingle();
  return (data as DriveFile | null) ?? null;
}

export async function getDriveAttachableFiles(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("drive_files").select("id,name,size_bytes").eq("workspace_id", workspaceId).eq("upload_status", "ready").is("deleted_at", null).order("updated_at", { ascending: false }).range(0, 99);
  return data ?? [];
}

export async function getDrivePreview(fileId: string) {
  const file = await getDriveFileForUser(fileId);
  if (!file || file.deleted_at || file.upload_status !== "ready") return null;
  const supabase = await createClient();
  if (DRIVE_IMAGE_MIME_TYPES.has(file.mime_type)) {
    const { data } = await supabase.storage.from("elyqora-drive").createSignedUrl(file.storage_path, 300);
    return { file, url: data?.signedUrl ?? null, text: null };
  }
  if (DRIVE_TEXT_MIME_TYPES.has(file.mime_type)) {
    const { data } = await supabase.storage.from("elyqora-drive").download(file.storage_path);
    if (!data) return { file, url: null, text: null };
    const text = (await data.text()).slice(0, 50000);
    return { file, url: null, text };
  }
  return { file, url: null, text: null };
}
