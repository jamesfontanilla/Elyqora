"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { requireUser, requireWorkspacePermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  NOTE_COLORS,
  NOTE_TITLE_LIMIT,
  parseNoteLabels,
  sanitizeNoteBody,
  sanitizeNoteChecklistItems,
  sanitizeNoteLabel,
  sanitizeNoteTitle,
} from "@/lib/notes/constants";
import type { NoteChecklistItem, NoteColor, NoteRecord, NoteScope, NoteVisibility } from "@/lib/types";

const uuid = z.string().uuid();
const noteColorEnum = z.enum(NOTE_COLORS.map((entry) => entry.value) as [NoteColor, ...NoteColor[]]);
const noteScopeEnum = z.enum(["personal", "workspace"]);
const noteVisibilityEnum = z.enum(["private", "workspace"]);
const checklistItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().max(200),
  checked: z.boolean(),
});
const noteLinkTargetEnum = z.enum(["project", "task", "contact", "ticket", "event", "course"]);

export interface NoteDraftInput {
  noteId: string;
  revision: number;
  title: string;
  bodyMd: string;
  checklistItems: NoteChecklistItem[];
  color: NoteColor;
  scope: NoteScope;
  visibility: NoteVisibility;
  pinned: boolean;
}

export interface NoteDraftResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
  revision?: number;
  conflict?: boolean;
}

async function loadNoteRecord(noteId: string) {
  const supabase = await createClient();
  const { data: note } = await supabase.from("notes").select("*").eq("id", noteId).maybeSingle();
  if (!note) throw new Error("Note not found or no longer available.");
  return { supabase, note: note as NoteRecord };
}

async function loadEditableNote(noteId: string) {
  const { supabase, note } = await loadNoteRecord(noteId);
  const { data: canEdit, error } = await supabase.rpc("can_edit_note", { target_note_id: noteId });
  if (error || !canEdit) throw new Error("You do not have permission to change this note.");
  return { supabase, note };
}

async function loadManageableNote(noteId: string) {
  const { supabase, note } = await loadNoteRecord(noteId);
  const { data: canManage, error } = await supabase.rpc("can_manage_note", { target_note_id: noteId });
  if (error || !canManage) throw new Error("You do not have permission to manage this note.");
  return { supabase, note };
}

async function recordNoteAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  action: string,
  noteId: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.rpc("record_audit_event", {
    target_workspace_id: workspaceId,
    event_action: action,
    event_entity_type: "note",
    event_entity_id: noteId,
    event_metadata: metadata,
  });
}

function revalidateNotes(noteId: string) {
  for (const path of ["/notes", "/notes/pinned", "/notes/archived", "/notes/recent", "/notes/trash", "/notes/labels", `/notes/${noteId}`]) {
    revalidatePath(path);
  }
}

function normalizeNoteVisibility(scope: NoteScope, visibility: NoteVisibility) {
  return scope === "personal" ? "private" : visibility;
}

function validateReminderValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function createNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const title = z.string().trim().max(NOTE_TITLE_LIMIT).optional().safeParse(formData.get("title"));
  const bodyMd = z.string().max(12000).safeParse(String(formData.get("bodyMd") ?? ""));
  const color = noteColorEnum.safeParse(formData.get("color"));
  const scope = noteScopeEnum.safeParse(formData.get("scope"));
  const visibility = noteVisibilityEnum.safeParse(formData.get("visibility"));
  const pinned = formData.get("pinned") === "true";
  if (!workspaceId.success || !title.success || !bodyMd.success || !color.success || !scope.success || !visibility.success) {
    return { error: "Check the note details before creating it." };
  }
  try {
    const user = await requireUser();
    const { user: workspaceUser } = await requireWorkspacePermission(workspaceId.data, "notes.write");
    const supabase = await createClient();
    const nextVisibility = normalizeNoteVisibility(scope.data, visibility.data);
    if (scope.data === "personal" && nextVisibility !== "private") return { error: "Personal notes must stay private." };
    const { data, error } = await supabase.from("notes").insert({
      workspace_id: workspaceId.data,
      title: sanitizeNoteTitle(title.data || "Untitled note"),
      body_md: sanitizeNoteBody(bodyMd.data ?? ""),
      checklist_items: [] as NoteChecklistItem[],
      scope: scope.data,
      visibility: nextVisibility,
      color: color.data,
      pinned,
      created_by: user.id,
      updated_by: user.id,
      revision: 0,
    }).select("id,workspace_id,scope").single();
    if (error || !data) return { error: error?.message ?? "The note could not be created." };
    if (data.scope === "workspace") {
      await recordNoteAudit(supabase, data.workspace_id, "note.created", data.id, {
        created_by: workspaceUser.id,
        scope: data.scope,
      });
    }
    revalidateNotes(data.id);
    redirect(`/notes/${data.id}`);
  } catch (error) {
    return actionError(error);
  }
  return { error: "The note could not be created." };
}

export async function saveNoteDraftAction(input: NoteDraftInput): Promise<NoteDraftResult> {
  const parsed = {
    noteId: uuid.safeParse(input.noteId),
    revision: z.number().int().nonnegative().safeParse(input.revision),
    title: z.string().max(NOTE_TITLE_LIMIT).safeParse(input.title),
    bodyMd: z.string().max(12000).safeParse(input.bodyMd),
    checklistItems: z.array(checklistItemSchema).max(30).safeParse(input.checklistItems),
    color: noteColorEnum.safeParse(input.color),
    scope: noteScopeEnum.safeParse(input.scope),
    visibility: noteVisibilityEnum.safeParse(input.visibility),
    pinned: z.boolean().safeParse(input.pinned),
  };
  if (!parsed.noteId.success || !parsed.revision.success || !parsed.title.success || !parsed.bodyMd.success || !parsed.checklistItems.success || !parsed.color.success || !parsed.scope.success || !parsed.visibility.success || !parsed.pinned.success) {
    return { ok: false, error: "Draft validation failed." };
  }

  try {
    const user = await requireUser();
    const { supabase, note } = await loadEditableNote(parsed.noteId.data);
    if (note.revision !== parsed.revision.data) {
      return { ok: false, error: "This note changed elsewhere. Refresh to keep editing.", conflict: true, revision: note.revision };
    }
    const title = sanitizeNoteTitle(parsed.title.data);
    const body_md = sanitizeNoteBody(parsed.bodyMd.data);
    const checklist_items = sanitizeNoteChecklistItems(parsed.checklistItems.data);
    const visibility = normalizeNoteVisibility(parsed.scope.data, parsed.visibility.data);
    const nextRevision = note.revision + 1;
    const { data: updated, error } = await supabase
      .from("notes")
      .update({
        title,
        body_md,
        checklist_items,
        color: parsed.color.data,
        scope: parsed.scope.data,
        visibility,
        pinned: parsed.pinned.data,
        updated_by: user.id,
        revision: nextRevision,
      })
      .eq("id", note.id)
      .eq("revision", note.revision)
      .select("revision,updated_at,scope,title,body_md,pinned,color,visibility")
      .single();
    if (error || !updated) {
      return { ok: false, error: error?.message ?? "This note changed elsewhere. Refresh to keep editing.", conflict: true, revision: note.revision };
    }
    if (note.scope === "workspace" || parsed.scope.data === "workspace") {
      const changedFields = [
        title !== note.title ? "title" : null,
        body_md !== note.body_md ? "body_md" : null,
        JSON.stringify(checklist_items) !== JSON.stringify(note.checklist_items) ? "checklist_items" : null,
        parsed.color.data !== note.color ? "color" : null,
        parsed.scope.data !== note.scope ? "scope" : null,
        visibility !== note.visibility ? "visibility" : null,
        parsed.pinned.data !== note.pinned ? "pinned" : null,
      ].filter(Boolean);
      if (changedFields.length > 0) {
        await recordNoteAudit(supabase, note.workspace_id, "note.updated", note.id, {
          changed_fields: changedFields,
          revision: updated.revision,
        });
      }
    }
    revalidateNotes(note.id);
    return { ok: true, savedAt: updated.updated_at, revision: updated.revision };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Draft could not be saved." };
  }
}

export async function saveNoteLabelsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  const rawLabels = String(formData.get("labels") ?? "");
  if (!noteId.success) return { error: "Select a valid note." };
  const labels = [...new Set(parseNoteLabels(rawLabels))].slice(0, 12);
  try {
    const user = await requireUser();
    const { supabase, note } = await loadEditableNote(noteId.data);
    const { error: deleteError } = await supabase.from("note_labels").delete().eq("note_id", note.id);
    if (deleteError) return { error: deleteError.message };
    for (const label of labels) {
      const { error } = await supabase.from("note_labels").insert({
        workspace_id: note.workspace_id,
        note_id: note.id,
        label: sanitizeNoteLabel(label),
        created_by: user.id,
      });
      if (error) return { error: error.message };
    }
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.labels_updated", note.id, { labels });
    }
    revalidateNotes(note.id);
    return { message: "Labels saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleNotePinnedAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  const pinned = formData.get("pinned") === "true";
  if (!noteId.success) return { error: "Select a valid note." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadEditableNote(noteId.data);
    const { error } = await supabase.from("notes").update({ pinned, updated_by: user.id, revision: note.revision + 1 }).eq("id", note.id).eq("revision", note.revision);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, pinned ? "note.pinned" : "note.unpinned", note.id, { pinned });
    }
    revalidateNotes(note.id);
    return { message: pinned ? "Note pinned." : "Note unpinned." };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleNoteArchiveAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  const archived = formData.get("archived") === "true";
  if (!noteId.success) return { error: "Select a valid note." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadManageableNote(noteId.data);
    const payload = archived
      ? { archived_at: new Date().toISOString(), archived_by: user.id, updated_by: user.id, revision: note.revision + 1 }
      : { archived_at: null, archived_by: null, updated_by: user.id, revision: note.revision + 1 };
    const { error } = await supabase.from("notes").update(payload).eq("id", note.id).eq("revision", note.revision);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, archived ? "note.archived" : "note.unarchived", note.id);
    }
    revalidateNotes(note.id);
    return { message: archived ? "Note archived." : "Note moved back to active notes." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  if (!noteId.success) return { error: "Select a valid note." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadManageableNote(noteId.data);
    await supabase.from("note_reminders").update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_by: user.id,
      updated_by: user.id,
    }).eq("note_id", note.id).eq("status", "scheduled");
    const { error } = await supabase.from("notes").update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      updated_by: user.id,
      revision: note.revision + 1,
    }).eq("id", note.id).eq("revision", note.revision);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.deleted", note.id);
    }
    revalidateNotes(note.id);
    revalidatePath("/hub");
    return { message: "Note moved to the trash." };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  if (!noteId.success) return { error: "Select a valid note." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadManageableNote(noteId.data);
    const { error } = await supabase.from("notes").update({
      deleted_at: null,
      deleted_by: null,
      updated_by: user.id,
      revision: note.revision + 1,
    }).eq("id", note.id).eq("revision", note.revision);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.restored", note.id);
    }
    revalidateNotes(note.id);
    return { message: "Note restored." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveNoteReminderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  const reminderValue = z.string().trim().min(1, "Choose a reminder date and time.").safeParse(String(formData.get("remindAt") ?? ""));
  if (!noteId.success || !reminderValue.success) return { error: reminderValue.success ? "Select a valid note." : reminderValue.error.issues[0]?.message };
  const remindAt = validateReminderValue(reminderValue.data);
  if (!remindAt) return { error: "Choose a valid reminder date and time." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadEditableNote(noteId.data);
    const { data: existing } = await supabase.from("note_reminders").select("*").eq("note_id", note.id).maybeSingle();
    const payload = {
      workspace_id: note.workspace_id,
      note_id: note.id,
      remind_at: remindAt,
      status: "scheduled" as const,
      updated_by: user.id,
      created_by: user.id,
      dismissed_at: null,
      dismissed_by: null,
    };
    const { error } = existing
      ? await supabase.from("note_reminders").update({
          remind_at: remindAt,
          status: "scheduled",
          updated_by: user.id,
          dismissed_at: null,
          dismissed_by: null,
        }).eq("note_id", note.id)
      : await supabase.from("note_reminders").insert(payload);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.reminder_saved", note.id, { remind_at: remindAt });
    }
    revalidateNotes(note.id);
    revalidatePath("/hub");
    return { message: "Reminder saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function clearNoteReminderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  if (!noteId.success) return { error: "Select a valid note." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadEditableNote(noteId.data);
    const { error } = await supabase.from("note_reminders").update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_by: user.id,
      updated_by: user.id,
    }).eq("note_id", note.id);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.reminder_cleared", note.id);
    }
    revalidateNotes(note.id);
    revalidatePath("/hub");
    return { message: "Reminder cleared." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addNoteLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  const targetId = uuid.safeParse(formData.get("targetId"));
  const targetType = noteLinkTargetEnum.safeParse(formData.get("targetType"));
  if (!noteId.success || !targetId.success || !targetType.success) return { error: "Choose a valid linked record." };
  try {
    const user = await requireUser();
    const { supabase, note } = await loadEditableNote(noteId.data);
    const { error } = await supabase.from("note_links").upsert({
      workspace_id: note.workspace_id,
      note_id: note.id,
      target_type: targetType.data,
      target_id: targetId.data,
      created_by: user.id,
    }, { onConflict: "note_id,target_type,target_id" });
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.link_added", note.id, { target_type: targetType.data, target_id: targetId.data });
    }
    revalidateNotes(note.id);
    return { message: "Link added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeNoteLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const noteId = uuid.safeParse(formData.get("noteId"));
  const linkId = uuid.safeParse(formData.get("linkId"));
  if (!noteId.success || !linkId.success) return { error: "Choose a valid link." };
  try {
    const { supabase, note } = await loadEditableNote(noteId.data);
    const { error } = await supabase.from("note_links").delete().eq("id", linkId.data).eq("note_id", note.id);
    if (error) return { error: error.message };
    if (note.scope === "workspace") {
      await recordNoteAudit(supabase, note.workspace_id, "note.link_removed", note.id, { link_id: linkId.data });
    }
    revalidateNotes(note.id);
    return { message: "Link removed." };
  } catch (error) {
    return actionError(error);
  }
}
