import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getDriveStorageSettings } from "@/lib/drive/queries";
import { DRIVE_BUCKET, validateDriveUpload } from "@/lib/drive/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const folderValue = String(formData.get("folderId") ?? "");
    const folderId = folderValue || null;
    const file = formData.get("file");
    if (!workspaceId || !(file instanceof File)) return NextResponse.json({ error: "Choose a file and workspace." }, { status: 400 });

    const supabase = await createClient();
    const { data: canWrite, error: permissionError } = await supabase.rpc("has_workspace_permission", { target_workspace_id: workspaceId, required_permission: "drive.write" });
    if (permissionError || !canWrite) return NextResponse.json({ error: "You do not have permission to upload files here." }, { status: 403 });
    if (folderId) {
      const { data: folder } = await supabase.from("drive_folders").select("id").eq("id", folderId).eq("workspace_id", workspaceId).is("deleted_at", null).maybeSingle();
      if (!folder) return NextResponse.json({ error: "That destination folder is not available." }, { status: 400 });
    }

    const settings = await getDriveStorageSettings(workspaceId);
    const validation = validateDriveUpload({ name: file.name, type: file.type, size: file.size }, settings);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 413 });
    const { data: usage, error: usageError } = await supabase.rpc("get_drive_storage_usage", { target_workspace_id: workspaceId });
    if (usageError) return NextResponse.json({ error: "Storage usage could not be checked." }, { status: 503 });
    if (Number(usage ?? 0) + file.size > settings.quota_bytes) return NextResponse.json({ error: "This upload would exceed the workspace storage quota." }, { status: 413 });

    const fileId = randomUUID();
    const storagePath = `${workspaceId}/${fileId}/${validation.safeName}`;
    const { error: metadataError } = await supabase.from("drive_files").insert({
      id: fileId,
      workspace_id: workspaceId,
      folder_id: folderId,
      name: validation.safeName,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      upload_status: "pending",
      created_by: user.id,
      updated_by: user.id,
    });
    if (metadataError) return NextResponse.json({ error: metadataError.message }, { status: 400 });

    const { error: storageError } = await supabase.storage.from(DRIVE_BUCKET).upload(storagePath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
    if (storageError) {
      await supabase.from("drive_files").update({ upload_status: "failed", deleted_at: new Date().toISOString(), deleted_by: user.id, updated_by: user.id }).eq("id", fileId);
      await supabase.storage.from(DRIVE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: `Upload failed: ${storageError.message}` }, { status: 502 });
    }

    const { error: readyError } = await supabase.from("drive_files").update({ upload_status: "ready", updated_by: user.id }).eq("id", fileId).eq("created_by", user.id);
    if (readyError) {
      await supabase.from("drive_files").update({ upload_status: "failed", deleted_at: new Date().toISOString(), deleted_by: user.id, updated_by: user.id }).eq("id", fileId);
      await supabase.storage.from(DRIVE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "File metadata could not be finalized." }, { status: 502 });
    }

    await supabase.rpc("record_audit_event", { target_workspace_id: workspaceId, event_action: "drive.file.uploaded", event_entity_type: "drive_file", event_entity_id: fileId, event_metadata: { name: validation.safeName, size_bytes: file.size, mime_type: file.type } });
    return NextResponse.json({ file: { id: fileId, name: validation.safeName, sizeBytes: file.size, mimeType: file.type } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
