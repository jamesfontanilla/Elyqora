import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_BUCKET, DRIVE_IMAGE_MIME_TYPES, DRIVE_TEXT_MIME_TYPES } from "@/lib/drive/constants";
import { recordDriveAccess } from "@/lib/actions/drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser();
    const fileId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("fileId"));
    if (!fileId.success) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const supabase = await createClient();
    const { data: file } = await supabase.from("drive_files").select("id,workspace_id,storage_path,mime_type,name").eq("id", fileId.data).maybeSingle();
    if (!file) return NextResponse.json({ error: "File not found or access denied." }, { status: 404 });
    if (DRIVE_IMAGE_MIME_TYPES.has(file.mime_type)) {
      const { data, error } = await supabase.storage.from(DRIVE_BUCKET).createSignedUrl(file.storage_path, 300);
      if (error || !data?.signedUrl) return NextResponse.json({ error: "A preview link could not be created." }, { status: 503 });
      await recordDriveAccess(file.workspace_id, file.id, "preview");
      return NextResponse.redirect(data.signedUrl);
    }
    if (!DRIVE_TEXT_MIME_TYPES.has(file.mime_type)) return NextResponse.json({ error: "Preview is not available for this file type." }, { status: 415 });
    const { data, error } = await supabase.storage.from(DRIVE_BUCKET).download(file.storage_path);
    if (error || !data) return NextResponse.json({ error: "The preview could not be loaded." }, { status: 503 });
    const content = (await data.text()).slice(0, 50000);
    await recordDriveAccess(file.workspace_id, file.id, "preview");
    return new NextResponse(content, { headers: { "Content-Type": `${file.mime_type}; charset=utf-8`, "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Preview failed." }, { status: 500 });
  }
}
