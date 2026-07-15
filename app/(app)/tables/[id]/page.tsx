import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace, getWorkspaceMembers } from "@/lib/workspaces/current";
import { TABLE_PAGE_SIZE } from "@/lib/tables/constants";
import { getTableViewState } from "@/lib/tables/queries";
import { CsvImportPanel, DeleteTableForm, TableColumnActions, TableColumnForm, TableMetadataForm, TableRowCard, TableRowForm, TableViewForm } from "@/components/tables/forms";
import { formatRelativeDate } from "@/lib/utils";

type SearchParams = Promise<{ viewId?: string; page?: string; search?: string }>;

export default async function TablePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const { id } = await params;
  const query = await searchParams;
  const viewId = query.viewId && /^[0-9a-f-]{36}$/i.test(query.viewId) ? query.viewId : null;
  const search = (query.search ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const [tableState, canWrite, canManage, members] = await Promise.all([
    getTableViewState({ workspaceId: workspace.id, tableId: id, userId: user.id, viewId, page, search, pageSize: TABLE_PAGE_SIZE }),
    hasPermission(workspace.id, "tables.write"),
    hasPermission(workspace.id, "tables.manage"),
    getWorkspaceMembers(workspace.id),
  ]);
  if (!tableState || tableState.table.workspace_id !== workspace.id) notFound();

  const totalPages = tableState.totalPages;
  const selectedView = tableState.activeView;
  const searchQuery = new URLSearchParams();
  if (viewId) searchQuery.set("viewId", viewId);
  if (search) searchQuery.set("search", search);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/tables" className="inline-flex items-center gap-2 text-sm font-semibold text-moss"><ArrowLeft size={16} />Tables</Link>
        <div className="flex items-center gap-2">
          <a href={`/api/tables/export?tableId=${id}${viewId ? `&viewId=${viewId}` : ""}`} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-semibold text-moss"><Download size={15} />Export CSV</a>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                  <p className="eyebrow">Workspace / Tables</p>
                  <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">{tableState.table.name}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667878]">{tableState.table.description || "A lightweight structured-data table."}</p>
                  <p className="mt-2 text-xs text-[#8a9992]">Updated {formatRelativeDate(tableState.table.updated_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tableState.views.map((view) => <Link key={view.id} href={`/tables/${id}?viewId=${view.id}`} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedView?.id === view.id ? "border-moss bg-mint text-moss" : "border-[var(--line)] bg-white text-[#667878]"}`}>{view.name}</Link>)}
                </div>
              </div>
            </CardHeader>
          </Card>

          {canWrite && <TableMetadataForm workspaceId={workspace.id} table={tableState.table} />}

          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="eyebrow">Rows</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Current view</h2>
                </div>
                <form method="get" className="flex gap-2">
                  {viewId && <input type="hidden" name="viewId" value={viewId} />}
                  <Input name="search" defaultValue={search} placeholder="Search row values" aria-label="Search rows" />
                  <Button type="submit" variant="secondary" aria-label="Search rows"><FileText size={16} /></Button>
                </form>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tableState.windowed && <div className="rounded-xl bg-sand/60 p-4 text-sm text-[#667878]">This view uses a bounded row window to keep filtering and sorting fast.</div>}
              {canWrite && <TableRowForm workspaceId={workspace.id} tableId={id} columns={tableState.columns} members={members as never} submitLabel="Add row" />}
              {tableState.rows.length === 0 ? (
                <div className="rounded-2xl bg-sand/60 p-8 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-moss"><Table2 size={20} /></div>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-ink">No rows yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667878]">Add the first row or import a small CSV to give this table something useful to show.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {tableState.rows.map((row) => (
                    <TableRowCard
                      key={row.id}
                      workspaceId={workspace.id}
                      tableId={id}
                      row={row}
                      columns={tableState.columns}
                      visibleColumns={tableState.visibleColumns}
                      comments={tableState.commentsByRowId[row.id] ?? []}
                      members={members as never}
                      memberLookup={tableState.memberLookup}
                      canEdit={canWrite}
                      canManage={canManage}
                    />
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm">
                  <span className="text-[#667878]">Page {tableState.page} of {totalPages}</span>
                  <div className="flex gap-2">
                    {tableState.page > 1 && <Link href={`/tables/${id}?${withPage(searchQuery.toString(), tableState.page - 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Previous</Link>}
                    {tableState.page < totalPages && <Link href={`/tables/${id}?${withPage(searchQuery.toString(), tableState.page + 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Next</Link>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {canWrite && (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><h2 className="font-display text-2xl font-semibold text-ink">Columns</h2></CardHeader>
                <CardContent className="space-y-3">
                  {tableState.columns.map((column) => (
                    <details key={column.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink">
                        <span>{column.name} <span className="text-xs font-normal text-[#8a9992]">({column.column_key})</span></span>
                        <Badge className={column.is_hidden ? "bg-sand text-[#667878]" : "bg-mint text-moss"}>{column.is_hidden ? "Hidden" : "Visible"}</Badge>
                      </summary>
                      <div className="mt-4 space-y-4">
                        <TableColumnForm workspaceId={workspace.id} tableId={id} column={column} />
                        <TableColumnActions workspaceId={workspace.id} tableId={id} column={column} />
                      </div>
                    </details>
                  ))}
                  <details className="rounded-2xl border border-[var(--line)] bg-sand/30 p-4" open>
                    <summary className="cursor-pointer text-sm font-semibold text-ink">Add column</summary>
                    <div className="mt-4"><TableColumnForm workspaceId={workspace.id} tableId={id} /></div>
                  </details>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><h2 className="font-display text-2xl font-semibold text-ink">Saved views</h2></CardHeader>
                <CardContent className="space-y-4">
                  <TableViewForm workspaceId={workspace.id} tableId={id} columns={tableState.columns} view={selectedView} />
                </CardContent>
              </Card>
            </div>
          )}

          {canWrite && <CsvImportPanel workspaceId={workspace.id} tableId={id} columns={tableState.columns} />}
        </article>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl font-semibold text-ink">Status</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#667878]">
              <div className="flex items-center justify-between"><span>Columns</span><span className="font-semibold text-ink">{tableState.columns.length}</span></div>
              <div className="flex items-center justify-between"><span>Visible columns</span><span className="font-semibold text-ink">{tableState.visibleColumns.length}</span></div>
              <div className="flex items-center justify-between"><span>Rows in view</span><span className="font-semibold text-ink">{tableState.totalRows}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-display text-xl font-semibold text-ink">Recent activity</h2></CardHeader>
            <CardContent>
              {tableState.recentActivity.length === 0 ? (
                <div className="rounded-xl bg-sand/60 p-4 text-sm text-[#667878]">No table activity yet.</div>
              ) : (
                <div className="space-y-3">
                  {tableState.recentActivity.map((event) => (
                    <div key={event.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
                      <div className="text-sm font-semibold text-ink">{event.action}</div>
                      <p className="mt-1 text-xs text-[#8a9992]">{event.metadata?.body ? String(event.metadata.body) : event.row_id}</p>
                      <p className="mt-2 text-xs text-[#8a9992]">{formatRelativeDate(event.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && tableState.deletedRows.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-display text-xl font-semibold text-ink">Recycle bin</h2>
                <p className="mt-1 text-sm text-[#667878]">Restore recently deleted rows before they disappear from view.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {tableState.deletedRows.map((row) => (
                  <TableRowCard
                    key={row.id}
                    workspaceId={workspace.id}
                    tableId={id}
                    row={row}
                    columns={tableState.columns}
                    visibleColumns={tableState.visibleColumns}
                    comments={tableState.commentsByRowId[row.id] ?? []}
                    members={members as never}
                    memberLookup={tableState.memberLookup}
                    canEdit={canWrite}
                    canManage={canManage}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {canManage && <DeleteTableForm workspaceId={workspace.id} table={tableState.table} />}
        </aside>
      </section>
    </div>
  );
}

function withPage(queryString: string, page: number) {
  const params = new URLSearchParams(queryString);
  params.set("page", String(page));
  return params.toString();
}
