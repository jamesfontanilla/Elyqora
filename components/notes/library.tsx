import Link from "next/link";
import { Archive, ArrowUpRight, Clock3, FileText, Pin, Search, Tags, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrackedLink } from "@/components/hub/tracked-link";
import { RestoreNoteForm } from "@/components/notes/forms";
import { formatNoteScope, formatNoteVisibility, getNoteColorClass, getNoteExcerpt } from "@/lib/notes/constants";
import { formatRelativeDate } from "@/lib/utils";
import type { NotesListData, NotesListMode } from "@/lib/notes/queries";
import type { Workspace } from "@/lib/types";

export function NotesLibrary({
  workspace,
  data,
  mode,
  search,
  basePath,
  label,
  canWrite,
}: {
  workspace: Workspace;
  data: NotesListData;
  mode: NotesListMode;
  search: string;
  basePath: string;
  label?: string | null;
  canWrite: boolean;
}) {
  const title = mode === "pinned"
    ? "Pinned notes"
    : mode === "archived"
      ? "Archived notes"
      : mode === "recent"
        ? "Recently edited notes"
        : mode === "trash"
          ? "Trash"
          : mode === "label"
            ? `#${label}`
            : "All notes";
  const description = mode === "pinned"
    ? "Keep the notes you reach for most at the top."
    : mode === "archived"
      ? "Archived notes stay out of the way but remain available."
      : mode === "recent"
        ? "See the notes that were updated most recently."
        : mode === "trash"
          ? "Deleted notes stay recoverable until you restore them."
          : mode === "label"
            ? `Notes tagged with ${label ?? "this label"}.`
            : "Capture small thoughts, fast reminders, and lightweight workspace context.";

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Workspace / Notes</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667878]">{description} Notes stay lighter than Docs and are tuned for quick capture in {workspace.name}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hub"><Button variant="secondary">Back to Hub</Button></Link>
          {canWrite && <Link href="/notes/new"><Button>New note</Button></Link>}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard icon={<FileText size={18} />} label="Active" value={String(data.counts.active)} detail="Workspace notes visible now" />
        <StatCard icon={<Pin size={18} />} label="Pinned" value={String(data.counts.pinned)} detail="Quick access notes" />
        <StatCard icon={<Archive size={18} />} label="Archived" value={String(data.counts.archived)} detail="Kept out of the way" />
        <StatCard icon={<Clock3 size={18} />} label="Reminders" value={String(data.counts.reminders)} detail="Scheduled reminders" />
        <StatCard icon={<Tags size={18} />} label="Personal" value={String(data.counts.personal)} detail="Only you can see these" />
        <StatCard icon={<Trash2 size={18} />} label="Workspace" value={String(data.counts.workspace)} detail="Shared workspace notes" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#667878]">
                  {navigationLinks(basePath).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-1.5 transition ${item.active ? "bg-mint text-moss" : "bg-sand/60 text-[#667878] hover:bg-sand hover:text-ink"}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
                  {mode === "label" ? `#${label ?? "label"}` : mode === "trash" ? "Deleted notes" : "Notes"}
                </h2>
              </div>
              <form method="get" className="flex gap-2">
                <input type="hidden" name="page" value="1" />
                <Input name="search" defaultValue={search} placeholder="Search notes" aria-label="Search notes" />
                <Button type="submit" variant="secondary" aria-label="Search">
                  <Search size={16} />
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {mode === "all" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <QuickLink href="/notes/pinned" title="Pinned notes" body="Jump straight to notes you reach for often." />
                <QuickLink href="/notes/recent" title="Recently edited" body="See the freshest notes first." />
                <QuickLink href="/notes/labels" title="Browse labels" body="Filter by tags and keep ideas organized." />
              </div>
            )}

            {mode === "all" && data.recentNotes.length > 0 && !search && (
              <div className="rounded-3xl border border-[var(--line)] bg-sand/30 p-4">
                <p className="eyebrow">Your trail</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-ink">Recently edited</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recentNotes.map((note) => <NoteTrailCard key={note.id} workspaceId={workspace.id} note={note} />)}
                </div>
              </div>
            )}

            {mode === "all" && data.pinnedNotes.length > 0 && !search && (
              <div className="rounded-3xl border border-[var(--line)] bg-sand/30 p-4">
                <p className="eyebrow">Pinned notes</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-ink">Keep these close</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.pinnedNotes.map((note) => <NoteTrailCard key={note.id} workspaceId={workspace.id} note={note} />)}
                </div>
              </div>
            )}

            <div className="divide-y divide-[var(--line)]">
              {data.notes.length === 0 ? (
                <div className="rounded-3xl bg-sand/60 p-8 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-moss"><FileText size={20} /></div>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{emptyTitle(mode)}</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667878]">{emptyBody(mode)}</p>
                </div>
              ) : data.notes.map((note) => (
                <article key={note.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${getNoteColorClass(note.color)}`}>
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <TrackedLink href={`/notes/${note.id}`} workspaceId={workspace.id} entityId={note.id} entityType="note" icon="N" label={note.title} className="focus-ring block truncate text-lg font-semibold text-ink hover:text-moss">
                      {note.title}
                    </TrackedLink>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667878]">{getNoteExcerpt(note.body_md, note.checklist_items) || "Empty note"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className={note.scope === "personal" ? "bg-sand text-[#667878]" : "bg-mint text-moss"}>{formatNoteScope(note.scope)}</Badge>
                      <Badge className={note.visibility === "private" ? "bg-sand text-[#667878]" : "bg-mint text-moss"}>{formatNoteVisibility(note.visibility)}</Badge>
                      {note.pinned && <Badge className="bg-[#eef8f3] text-moss">Pinned</Badge>}
                      {note.archived_at && <Badge className="bg-[#f5ecff] text-[#7d4f9e]">Archived</Badge>}
                      {data.labelsByNote[note.id]?.slice(0, 4).map((labelName) => <Badge key={`${note.id}-${labelName}`} className="bg-sand text-[#667878]">#{labelName}</Badge>)}
                    </div>
                    <div className="mt-2 text-xs text-[#8a9992]">
                      {mode === "trash" && note.deleted_at ? `Deleted ${formatRelativeDate(note.deleted_at)}` : `Updated ${formatRelativeDate(note.updated_at)}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mode === "trash" ? (
                      <RestoreNoteForm noteId={note.id} />
                    ) : (
                      <Link href={`/notes/${note.id}`} className="focus-ring rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Open</Link>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm">
                <span className="text-[#667878]">Page {data.page} of {data.totalPages}</span>
                <div className="flex gap-2">
                  {data.page > 1 && <Link href={`${basePath}?${withPage(search, data.page - 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Previous</Link>}
                  {data.page < data.totalPages && <Link href={`${basePath}?${withPage(search, data.page + 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Next</Link>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {mode === "all" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Popular labels</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Browse by tag</h2>
                  </div>
                  <Tags size={18} className="text-moss" />
                </div>
              </CardHeader>
              <CardContent>
                {data.labels.length === 0 ? <p className="text-sm text-[#667878]">No labels yet.</p> : <div className="flex flex-wrap gap-2">{data.labels.slice(0, 12).map((item) => <Link key={item.label} href={`/notes/labels/${encodeURIComponent(item.label)}`} className="rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-[#667878] hover:bg-mint hover:text-moss">#{item.label} · {item.count}</Link>)}</div>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Summary</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Workspace snapshot</h2>
                </div>
                <ArrowUpRight size={18} className="text-moss" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#667878]">
              <SummaryRow label="Total visible" value={String(data.totalNotes)} />
              <SummaryRow label="Recent notes" value={String(data.recentNotes.length)} />
              <SummaryRow label="Pinned notes" value={String(data.pinnedNotes.length)} />
              <SummaryRow label="Label count" value={String(data.labels.length)} />
            </CardContent>
          </Card>

          {mode === "all" && data.reminders.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Upcoming reminders</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Reminders in motion</h2>
                  </div>
                  <Clock3 size={18} className="text-moss" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.reminders.slice(0, 5).map((reminder) => (
                  <div key={reminder.id} className="rounded-2xl bg-sand/50 p-4">
                    <div className="text-sm font-semibold text-ink">{reminder.note?.title ?? "Note reminder"}</div>
                    <div className="mt-1 text-xs text-[#667878]">{new Date(reminder.remind_at).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

function NoteTrailCard({ note, workspaceId }: { note: { id: string; title: string; updated_at: string }; workspaceId: string }) {
  return (
    <TrackedLink href={`/notes/${note.id}`} workspaceId={workspaceId} entityId={note.id} entityType="note" icon="N" label={note.title} className="focus-ring flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3">
      <FileText size={15} className="shrink-0 text-moss" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{note.title}</span>
        <span className="block text-xs text-[#8a9992]">{formatRelativeDate(note.updated_at)}</span>
      </span>
      <ArrowUpRight size={15} className="text-[#9aa8a2]" />
    </TrackedLink>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[var(--line)] bg-sand/30 p-4 transition hover:bg-mint">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-1 text-xs leading-5 text-[#8a9992]">{body}</div>
    </Link>
  );
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <Card><CardContent><div className="mb-5 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-moss">{icon}</span><span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a9992]">Summary</span></div><p className="text-sm text-[#667878]">{label}</p><p className="mt-1 text-3xl font-semibold text-ink">{value}</p><p className="mt-2 text-xs leading-5 text-[#8a9992]">{detail}</p></CardContent></Card>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><span className="font-semibold text-ink">{value}</span></div>;
}

function navigationLinks(basePath: string) {
  const links = [
    { href: "/notes", label: "All" },
    { href: "/notes/pinned", label: "Pinned" },
    { href: "/notes/archived", label: "Archived" },
    { href: "/notes/recent", label: "Recent" },
    { href: "/notes/labels", label: "Labels" },
    { href: "/notes/trash", label: "Trash" },
  ];
  return links.map((link) => ({ ...link, active: link.href === "/notes/labels" ? basePath.startsWith("/notes/labels") : basePath === link.href }));
}

export function emptyTitle(mode: NotesListMode) {
  if (mode === "pinned") return "No pinned notes";
  if (mode === "archived") return "No archived notes";
  if (mode === "recent") return "No recent edits";
  if (mode === "trash") return "Trash is empty";
  if (mode === "label") return "No notes match this label";
  return "No notes yet";
}

export function emptyBody(mode: NotesListMode) {
  if (mode === "pinned") return "Pin a note from the editor when you want it to stay near the top.";
  if (mode === "archived") return "Archive a note to keep it around without leaving it in the main list.";
  if (mode === "recent") return "When you save a note, it will appear here with the newest edits first.";
  if (mode === "trash") return "Deleted notes can be restored from their detail page.";
  if (mode === "label") return "Try another label or clear the search field.";
  return "Create a note to capture a thought, a reminder, or a quick workspace thread.";
}

function withPage(search: string, page: number) {
  const params = new URLSearchParams(search ? `search=${encodeURIComponent(search)}` : "");
  params.set("page", String(page));
  return params.toString();
}
