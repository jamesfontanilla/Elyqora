import { NextResponse } from "next/server";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getTableExportCsv } from "@/lib/tables/queries";
import { sanitizeTableName } from "@/lib/tables/constants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace || !(await hasPermission(workspace.id, "tables.read"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const tableId = url.searchParams.get("tableId");
  if (!tableId) return NextResponse.json({ error: "Missing tableId" }, { status: 400 });
  const viewId = url.searchParams.get("viewId");
  const exportResult = await getTableExportCsv(workspace.id, tableId, viewId);
  if (!exportResult) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(exportResult.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sanitizeTableName(exportResult.table.name).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "table"}.csv"`,
    },
  });
}
