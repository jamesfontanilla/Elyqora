import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getCurrentUser, getMembership, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getNoteDetail } from "@/lib/notes/queries";
import { NoteEditor } from "@/components/notes/editor";
import { NoteSidebar } from "@/components/notes/sidebar";
import { canEditNoteRecord, canManageNoteRecord } from "@/lib/notes/access";
import { Badge } from "@/components/ui/badge";

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const { id } = await params;
  const [noteData, membership, canReadNotes, canWriteNotes, canManageNotes] = await Promise.all([
    getNoteDetail(id, workspace.id),
    getMembership(workspace.id, user.id),
    hasPermission(workspace.id, "notes.read"),
    hasPermission(workspace.id, "notes.write"),
    hasPermission(workspace.id, "notes.manage"),
  ]);
  if (!noteData) notFound();
  const access = {
    workspaceId: workspace.id,
    noteWorkspaceId: noteData.note.workspace_id,
    noteScope: noteData.note.scope,
    noteVisibility: noteData.note.visibility,
    membershipStatus: membership ? "active" : "removed",
    createdBy: noteData.note.created_by,
    userId: user.id,
    canReadNotes,
    canWriteNotes,
    canManageNotes,
    isDeleted: Boolean(noteData.note.deleted_at),
  } as const;
  const canEdit = canEditNoteRecord(access);
  const canManage = canManageNoteRecord(access);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="eyebrow">Workspace / Notes</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href="/notes" className="inline-flex items-center gap-2 text-sm font-semibold text-moss hover:underline"><ArrowLeft size={16} />Back to notes</Link>
            {noteData.note.deleted_at && <Badge className="bg-[#fff0ef] text-coral">Trash</Badge>}
            {noteData.note.archived_at && <Badge className="bg-[#f5ecff] text-[#7d4f9e]">Archived</Badge>}
          </div>
          <h1 className="mt-3 min-w-0 font-display text-4xl font-semibold tracking-tight text-ink">{noteData.note.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667878]">
            {noteData.note.scope === "personal" ? "This note is visible only to you." : noteData.note.visibility === "workspace" ? "This workspace note can be seen by people with read access." : "This workspace note stays private unless you choose otherwise."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8a9992]">
          <Sparkles size={14} className="text-moss" />
          Reusable note editor
        </div>
      </section>

      <NoteEditor note={noteData.note} canEdit={canEdit} />

      <NoteSidebar
        workspaceId={workspace.id}
        note={noteData.note}
        labels={noteData.labels}
        links={noteData.links}
        reminders={noteData.reminders}
        attachments={noteData.attachments}
        attachableFiles={noteData.attachableFiles}
        canEdit={canEdit}
        canManage={canManage}
      />
    </div>
  );
}
