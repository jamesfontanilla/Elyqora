import Link from "next/link";
import { Tag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getNotesList } from "@/lib/notes/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function NoteLabelsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const params = await searchParams;
  const search = (params.search ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const data = await getNotesList({ workspaceId: workspace.id, search, page, mode: "all" });

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Workspace / Notes</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Labels</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667878]">Browse the labels that are already shaping notes in {workspace.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/notes"><Button variant="secondary">Back to notes</Button></Link>
          <Link href="/notes/new"><Button>New note</Button></Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Label cloud</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">All note labels</h2>
            </div>
            <Tag size={18} className="text-moss" />
          </div>
        </CardHeader>
        <CardContent>
          {data.labels.length === 0 ? (
            <div className="rounded-2xl bg-sand/50 p-6 text-sm text-[#667878]">No labels yet. Save a note and add a few tags.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.labels.map((item) => (
                <Link key={item.label} href={`/notes/labels/${encodeURIComponent(item.label)}`} className="rounded-full border border-[var(--line)] bg-sand px-3 py-1.5 text-xs font-semibold text-[#667878] hover:bg-mint hover:text-moss">
                  #{item.label} · {item.count}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
