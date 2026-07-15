import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) to seed Drive Lite storage.");
  process.exitCode = 1;
} else {
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const content = await readFile(new URL("../supabase/seed-assets/elyqora-welcome.txt", import.meta.url));
  const { data: workspaces, error: workspaceError } = await supabase.from("workspaces").select("id,owner_id").is("deleted_at", null).limit(20);
  if (workspaceError) throw workspaceError;
  for (const workspace of workspaces ?? []) {
    const { data: existing } = await supabase.from("drive_files").select("id").eq("workspace_id", workspace.id).eq("name", "elyqora-welcome.txt").is("deleted_at", null).maybeSingle();
    if (existing) continue;
    const { data: welcomeFolder } = await supabase.from("drive_folders").select("id").eq("workspace_id", workspace.id).eq("name", "Welcome").is("deleted_at", null).maybeSingle();
    const fileId = randomUUID();
    const storagePath = `${workspace.id}/${fileId}/elyqora-welcome.txt`;
    const { error: uploadError } = await supabase.storage.from("elyqora-drive").upload(storagePath, content, { contentType: "text/plain", upsert: false });
    if (uploadError) throw uploadError;
    const { error: metadataError } = await supabase.from("drive_files").insert({ id: fileId, workspace_id: workspace.id, folder_id: welcomeFolder?.id ?? null, name: "elyqora-welcome.txt", storage_path: storagePath, mime_type: "text/plain", size_bytes: content.byteLength, upload_status: "ready", access_level: "workspace", created_by: workspace.owner_id, updated_by: workspace.owner_id });
    if (metadataError) {
      await supabase.storage.from("elyqora-drive").remove([storagePath]);
      throw metadataError;
    }
    console.log(`Seeded ${workspace.id}/elyqora-welcome.txt`);
  }
}
