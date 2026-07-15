"use client";

import { useActionState } from "react";
import { Archive, Pin, Trash2 } from "lucide-react";
import { AttachmentPicker } from "@/components/drive/attachment-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/auth/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  addNoteLinkAction,
  clearNoteReminderAction,
  deleteNoteAction,
  removeNoteLinkAction,
  saveNoteLabelsAction,
  saveNoteReminderAction,
  toggleNoteArchiveAction,
  toggleNotePinnedAction,
} from "@/lib/actions/notes";
import { detachDriveFileAction } from "@/lib/actions/drive";
import { NOTE_LINK_TARGETS } from "@/lib/notes/constants";
import { RestoreNoteForm } from "@/components/notes/forms";
import { formatBytes } from "@/lib/drive/constants";
import type { NoteAttachment, NoteLabel, NoteLink, NoteReminder, NoteRecord, DriveFile } from "@/lib/types";

type AttachFile = Pick<DriveFile, "id" | "name" | "size_bytes">;

export function NoteSidebar({
  workspaceId,
  note,
  labels,
  links,
  reminders,
  attachments,
  attachableFiles,
  canEdit,
  canManage,
}: {
  workspaceId: string;
  note: NoteRecord;
  labels: NoteLabel[];
  links: NoteLink[];
  reminders: NoteReminder[];
  attachments: Array<NoteAttachment & { file?: AttachFile | null }>;
  attachableFiles: AttachFile[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const reminder = reminders[0] ?? null;
  const labelsText = labels.map((label) => label.label).join(", ");
  return (
    <aside className="space-y-4">
      <section className="rounded-3xl border border-[var(--line)] bg-white p-4">
        <p className="eyebrow">Labels</p>
        {canEdit && !note.deleted_at ? <LabelsForm noteId={note.id} labels={labelsText} /> : <LabelList labels={labels} />}
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-4">
        <p className="eyebrow">Reminder</p>
        {canEdit && !note.deleted_at ? <ReminderForm noteId={note.id} reminder={reminder} /> : <ReminderSummary reminder={reminder} />}
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-4">
        <p className="eyebrow">Linked records</p>
        {canEdit && !note.deleted_at ? <LinksForm noteId={note.id} links={links} /> : <LinkList links={links} />}
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-4">
        <p className="eyebrow">Attachments</p>
        {canEdit && !note.deleted_at ? (
          <div className="space-y-4">
            <AttachmentPicker workspaceId={workspaceId} targetType="notes" targetId={note.id} files={attachableFiles.map((file) => ({ id: file.id, name: file.name, sizeBytes: file.size_bytes }))} attachedFileIds={attachments.map((attachment) => attachment.file_id)} />
            <AttachmentList note={note} attachments={attachments} workspaceId={workspaceId} />
          </div>
        ) : (
          <AttachmentList note={note} attachments={attachments} workspaceId={workspaceId} />
        )}
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-4">
        <p className="eyebrow">Actions</p>
        <div className="mt-3 space-y-3">
          {canEdit && !note.deleted_at && <PinToggle noteId={note.id} pinned={note.pinned} />}
          {canManage && !note.deleted_at && <ArchiveToggle noteId={note.id} archived={Boolean(note.archived_at)} />}
          {canManage && !note.deleted_at && <DeleteNote noteId={note.id} />}
          {note.deleted_at && canManage && <RestoreNoteForm noteId={note.id} />}
          {note.deleted_at && !canManage && <div className="rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]">Only owners and admins can restore this note.</div>}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-sand/30 p-4 text-xs leading-6 text-[#667878]">
        <p className="font-semibold text-ink">Note details</p>
        <div className="mt-3 space-y-2">
          <DetailRow label="Created" value={new Date(note.created_at).toLocaleString()} />
          <DetailRow label="Updated" value={new Date(note.updated_at).toLocaleString()} />
          <DetailRow label="Revision" value={String(note.revision)} />
          <DetailRow label="State" value={note.deleted_at ? "Trash" : note.archived_at ? "Archived" : "Active"} />
        </div>
      </section>
    </aside>
  );
}

function LabelsForm({ noteId, labels }: { noteId: string; labels: string }) {
  const [state, action] = useActionState(saveNoteLabelsAction, {});
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="noteId" value={noteId} />
      <Textarea name="labels" defaultValue={labels} placeholder="launch, ideas, follow-up" className="min-h-24" />
      <SubmitButton pendingLabel="Saving…">Save labels</SubmitButton>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

function LabelList({ labels }: { labels: NoteLabel[] }) {
  if (labels.length === 0) return <div className="mt-3 rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]">No labels yet.</div>;
  return <div className="mt-3 flex flex-wrap gap-2">{labels.map((label) => <Badge key={label.id} className="bg-sand text-[#667878]">#{label.label}</Badge>)}</div>;
}

function ReminderForm({ noteId, reminder }: { noteId: string; reminder: NoteReminder | null }) {
  const [state, saveAction] = useActionState(saveNoteReminderAction, {});
  return (
    <div className="mt-3 space-y-3">
      <form action={saveAction} className="space-y-2">
        <input type="hidden" name="noteId" value={noteId} />
        <Input name="remindAt" type="datetime-local" defaultValue={toLocalDateTimeValue(reminder?.remind_at ?? null)} />
        <SubmitButton pendingLabel="Saving…">Save reminder</SubmitButton>
        <FormMessage error={state.error} message={state.message} />
      </form>
      {reminder && <ClearButton noteId={noteId} />}
      {reminder ? <ReminderSummary reminder={reminder} /> : <div className="rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]">No reminder set.</div>}
    </div>
  );
}

function ClearButton({ noteId }: { noteId: string }) {
  const [state, action] = useActionState(clearNoteReminderAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="noteId" value={noteId} />
      <Button type="submit" variant="ghost" className="min-h-9 px-3 text-xs text-coral">
        Clear
      </Button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

function ReminderSummary({ reminder }: { reminder: NoteReminder | null }) {
  if (!reminder) return null;
  return <div className="rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]"><div className="font-semibold text-ink">Next reminder</div><div className="mt-1">{new Date(reminder.remind_at).toLocaleString()}</div><div className="mt-1 text-xs uppercase tracking-[0.08em] text-[#8a9992]">{reminder.status}</div></div>;
}

function LinksForm({ noteId, links }: { noteId: string; links: NoteLink[] }) {
  const [state, action] = useActionState(addNoteLinkAction, {});
  return (
    <div className="mt-3 space-y-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="noteId" value={noteId} />
        <Select name="targetType" defaultValue="project">
          {NOTE_LINK_TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
        </Select>
        <Input name="targetId" placeholder="Linked record UUID" />
        <SubmitButton pendingLabel="Linking…">Add link</SubmitButton>
        <FormMessage error={state.error} message={state.message} />
      </form>
      <LinkList noteId={noteId} links={links} />
    </div>
  );
}

function LinkList({ noteId, links }: { noteId?: string; links: NoteLink[] }) {
  if (links.length === 0) return <div className="rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]">No linked records yet.</div>;
  return <div className="space-y-2">{links.map((link) => <LinkRow key={link.id} noteId={noteId} link={link} />)}</div>;
}

function LinkRow({ noteId, link }: { noteId?: string; link: NoteLink }) {
  const [state, action] = useActionState(removeNoteLinkAction, {});
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{link.target_type}</div>
        <div className="truncate text-xs text-[#8a9992]">{link.target_id}</div>
      </div>
      {noteId && (
        <form action={action}>
          <input type="hidden" name="noteId" value={noteId} />
          <input type="hidden" name="linkId" value={link.id} />
          <Button type="submit" variant="ghost" className="min-h-9 px-2 text-coral">
            <Trash2 size={14} />
          </Button>
          <FormMessage error={state.error} message={state.message} />
        </form>
      )}
    </div>
  );
}

function AttachmentList({
  note,
  attachments,
  workspaceId,
}: {
  note: NoteRecord;
  attachments: Array<NoteAttachment & { file?: Pick<AttachFile, "id" | "name" | "size_bytes"> | null }>;
  workspaceId: string;
}) {
  if (attachments.length === 0) return <div className="rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]">No attachments yet.</div>;
  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{attachment.file?.name ?? "Attached file"}</div>
            <div className="text-xs text-[#8a9992]">{attachment.file ? formatBytes(attachment.file.size_bytes) : "Attached from Drive Lite"}</div>
          </div>
          <AttachmentDetachForm workspaceId={workspaceId} noteId={note.id} fileId={attachment.file_id} />
        </div>
      ))}
    </div>
  );
}

function AttachmentDetachForm({ workspaceId, noteId, fileId }: { workspaceId: string; noteId: string; fileId: string }) {
  const [state, action] = useActionState(detachDriveFileAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="fileId" value={fileId} />
      <input type="hidden" name="targetType" value="notes" />
      <input type="hidden" name="targetId" value={noteId} />
      <Button type="submit" variant="ghost" className="min-h-9 px-2 text-coral">
        <Trash2 size={14} />
      </Button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

function PinToggle({ noteId, pinned }: { noteId: string; pinned: boolean }) {
  const [state, action] = useActionState(toggleNotePinnedAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="pinned" value={String(!pinned)} />
      <Button type="submit" variant="secondary" className="min-h-9 w-full justify-start gap-2 px-3 text-xs">
        <Pin size={14} />
        {pinned ? "Unpin note" : "Pin note"}
      </Button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

function ArchiveToggle({ noteId, archived }: { noteId: string; archived: boolean }) {
  const [state, action] = useActionState(toggleNoteArchiveAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="archived" value={String(!archived)} />
      <Button type="submit" variant="secondary" className="min-h-9 w-full justify-start gap-2 px-3 text-xs">
        <Archive size={14} />
        {archived ? "Unarchive note" : "Archive note"}
      </Button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

function DeleteNote({ noteId }: { noteId: string }) {
  const [state, action] = useActionState(deleteNoteAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="noteId" value={noteId} />
      <Button type="submit" variant="danger" className="min-h-9 w-full justify-start gap-2 px-3 text-xs">
        <Trash2 size={14} />
        Move to trash
      </Button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[#667878]">{label}</span><span className="text-right font-semibold text-ink">{value}</span></div>;
}

function toLocalDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
