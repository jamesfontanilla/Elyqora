import Link from "next/link";
import { ArrowUpRight, Clock3, Search, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { TABLE_OVERVIEW_PAGE_SIZE } from "@/lib/tables/constants";
import { getTablesOverview } from "@/lib/tables/queries";
import { CreateTableForm } from "@/components/tables/forms";
import { TrackedLink } from "@/components/hub/tracked-link";
import { formatRelativeDate } from "@/lib/utils";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function TablesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const params = await searchParams;
  const search = (params.search ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [overview, canWrite] = await Promise.all([
    getTablesOverview(workspace.id, user.id, search, page, TABLE_OVERVIEW_PAGE_SIZE),
    hasPermission(workspace.id, "tables.write"),
  ]);
  const totalPages = Math.max(1, Math.ceil(overview.totalTables / TABLE_OVERVIEW_PAGE_SIZE));

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Workspace / Tables</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Structured data without spreadsheet sprawl.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667878]">Create compact tables for the things your workspace tracks, then keep them searchable, bounded, and easy to share.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hub"><Button variant="secondary">Back to Hub</Button></Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardContent><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-mint text-moss"><Table2 size={18} /></div><p className="text-sm text-[#667878]">Tables in this workspace</p><p className="mt-1 text-3xl font-semibold text-ink">{overview.totalTables}</p><p className="mt-2 text-xs text-[#8a9992]">Bounded pages with safe structured rows.</p></CardContent></Card>
        <Card><CardContent><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-sand text-moss"><Clock3 size={18} /></div><p className="text-sm text-[#667878]">Recent activity</p><p className="mt-1 text-3xl font-semibold text-ink">{overview.recentActivity.length}</p><p className="mt-2 text-xs text-[#8a9992]">Row changes and comments stay visible.</p></CardContent></Card>
        <Card><CardContent><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-sand text-moss"><Search size={18} /></div><p className="text-sm text-[#667878]">Search scope</p><p className="mt-1 text-3xl font-semibold text-ink">{search ? "Filtered" : "All"}</p><p className="mt-2 text-xs text-[#8a9992]">Table names search server-side before the page renders.</p></CardContent></Card>
      </section>

      {canWrite && <CreateTableForm workspaceId={workspace.id} />}

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow">Workspace tables</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Named tables</h2>
            </div>
            <form method="get" className="flex gap-2">
              <Input name="search" defaultValue={search} placeholder="Search tables" aria-label="Search tables" />
              <Button type="submit" variant="secondary" aria-label="Search tables"><Search size={16} /></Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {overview.tables.length === 0 ? (
            <div className="rounded-2xl bg-sand/60 p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-moss"><Table2 size={20} /></div>
              <h3 className="mt-4 font-display text-2xl font-semibold text-ink">No tables yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667878]">Create a small table for the rows your workspace needs, then add columns, views, and CSV imports as you grow.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {overview.tables.map((table) => {
                const counts = overview.countsByTable[table.id] ?? { rows: 0, columns: 0, views: 0 };
                return (
                  <TrackedLink key={table.id} href={`/tables/${table.id}`} workspaceId={workspace.id} entityId={table.id} entityType="table" icon="▦" className="focus-ring">
                    <Card className="border-[var(--line)] bg-sand/30 transition hover:bg-mint">
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-display text-2xl font-semibold text-ink">{table.name}</div>
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667878]">{table.description || "A small workspace table."}</p>
                          </div>
                          <ArrowUpRight size={16} className="shrink-0 text-[#9aa8a2]" />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-[#667878]">
                          <Badge className="bg-white text-moss">{counts.rows} rows</Badge>
                          <Badge className="bg-white text-moss">{counts.columns} columns</Badge>
                          <Badge className="bg-white text-moss">{counts.views} views</Badge>
                        </div>
                        <p className="text-xs text-[#8a9992]">Updated {formatRelativeDate(table.updated_at)}</p>
                      </CardContent>
                    </Card>
                  </TrackedLink>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm">
              <span className="text-[#667878]">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/tables?${withPage(search, page - 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Previous</Link>}
                {page < totalPages && <Link href={`/tables?${withPage(search, page + 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Next</Link>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-ink">Recent table activity</h2>
          <p className="mt-1 text-sm text-[#667878]">Activity stays bounded and scoped to the current workspace.</p>
        </CardHeader>
        <CardContent>
          {overview.recentActivity.length === 0 ? (
            <div className="rounded-xl bg-sand/60 p-5 text-sm text-[#667878]">No table activity yet.</div>
          ) : (
            <div className="space-y-3">
              {overview.recentActivity.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{event.action}</div>
                    <p className="text-xs text-[#8a9992]">{event.metadata?.body ? String(event.metadata.body) : event.row_id}</p>
                  </div>
                  <span className="text-xs text-[#8a9992]">{formatRelativeDate(event.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function withPage(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  return params.toString();
}
