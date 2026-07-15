import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_BUCKET } from "@/lib/drive/constants";
import { recordDriveAccess } from "@/lib/actions/drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser();
    const fileId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("fileId"));
    if (!fileId.success) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const supabase = await createClient();
    const { data: file } = await supabase.from("drive_files").select("id,workspace_id,storage_path").eq("id", fileId.data).maybeSingle();
    if (!file) return NextResponse.json({ error: "File not found or access denied." }, { status: 404 });
    const { data, error } = await supabase.storage.from(DRIVE_BUCKET).createSignedUrl(file.storage_path, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ error: "A download link could not be created." }, { status: 503 });
    await recordDriveAccess(file.workspace_id, file.id, "download");
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Download failed." }, { status: 500 });
  }
}
