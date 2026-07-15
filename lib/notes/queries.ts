import { createClient } from "@/lib/supabase/server";
import { getDriveAttachableFiles } from "@/lib/drive/queries";
import { NOTE_PAGE_SIZE } from "@/lib/notes/constants";
import type { DriveFile, NoteAttachment, NoteLabel, NoteLink, NoteReminder, NoteRecord } from "@/lib/types";

export type NotesListMode = "all" | "pinned" | "archived" | "recent" | "label" | "trash";

export interface NotesListData {
  notes: NoteRecord[];
  totalNotes: number;
  page: number;
  totalPages: number;
  labels: Array<{ label: string; count: number }>;
  labelsByNote: Record<string, string[]>;
  recentNotes: NoteRecord[];
  pinnedNotes: NoteRecord[];
  reminders: Array<NoteReminder & { note?: Pick<NoteRecord, "id" | "title" | "color" | "scope" | "visibility" | "pinned" | "archived_at"> | null }>;
  counts: {
    active: number;
    pinned: number;
    archived: number;
    reminders: number;
    personal: number;
    workspace: number;
  };
}

export interface NoteDetailData {
  note: NoteRecord;
  labels: NoteLabel[];
  links: NoteLink[];
  reminders: Array<NoteReminder & { note?: Pick<NoteRecord, "id" | "title" | "color" | "scope" | "visibility" | "pinned" | "archived_at"> | null }>;
  attachments: Array<NoteAttachment & { file?: Pick<DriveFile, "id" | "name" | "mime_type" | "size_bytes" | "upload_status"> | null }>;
  attachableFiles: Array<Pick<DriveFile, "id" | "name" | "size_bytes">>;
}

export async function getNotesList({
  workspaceId,
  search = "",
  page = 1,
  mode = "all",
  label,
  pageSize = NOTE_PAGE_SIZE,
}: {
  workspaceId: string;
  search?: string;
  page?: number;
  mode?: NotesListMode;
  label?: string | null;
  pageSize?: number;
}): Promise<NotesListData> {
  const supabase = await createClient();
  const offset = Math.max(0, page - 1) * pageSize;
  const normalizedSearch = search.trim().slice(0, 80);
  const labelFilter = label ? label.trim().toLowerCase().slice(0, 40) : null;

  let noteIds: string[] | null = null;
  if (mode === "label" && labelFilter) {
    const { data: labelRows } = await supabase
      .from("note_labels")
      .select("note_id")
      .eq("workspace_id", workspaceId)
      .eq("label", labelFilter)
      .range(0, 199);
    noteIds = [...new Set((labelRows ?? []).map((row) => row.note_id))];
    if (noteIds.length === 0) {
      return {
        notes: [],
        totalNotes: 0,
        page: 1,
        totalPages: 1,
        labels: [],
        labelsByNote: {},
        recentNotes: [],
        pinnedNotes: [],
        reminders: [],
        counts: { active: 0, pinned: 0, archived: 0, reminders: 0, personal: 0, workspace: 0 },
      };
    }
  }

  const baseNoteQuery = supabase.from("notes").select("*", { count: "exact" }).eq("workspace_id", workspaceId);
  let noteQuery = mode === "trash" ? baseNoteQuery.not("deleted_at", "is", null) : baseNoteQuery.is("deleted_at", null);
  if (mode === "archived") {
    noteQuery = noteQuery.not("archived_at", "is", null);
  } else if (mode !== "trash") {
    noteQuery = noteQuery.is("archived_at", null);
  }
  if (mode === "pinned") noteQuery = noteQuery.eq("pinned", true);
  if (mode === "label" && noteIds) noteQuery = noteQuery.in("id", noteIds);
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch.replace(/[%_,]/g, "\\$&")}%`;
    noteQuery = noteQuery.or(`title.ilike.${pattern},body_md.ilike.${pattern}`);
  }
  const orderedQuery = mode === "recent"
    ? noteQuery.order("updated_at", { ascending: false })
    : mode === "trash"
      ? noteQuery.order("deleted_at", { ascending: false }).order("updated_at", { ascending: false })
      : noteQuery.order("pinned", { ascending: false }).order("updated_at", { ascending: false });
  const notesResult = await orderedQuery.range(offset, offset + pageSize - 1);
  const notes = (notesResult.data ?? []) as NoteRecord[];
  const noteIdsOnPage = notes.map((note) => note.id);
  const labelsByNoteResult = noteIdsOnPage.length > 0
    ? await supabase.from("note_labels").select("note_id,label").eq("workspace_id", workspaceId).in("note_id", noteIdsOnPage).range(0, 299)
    : { data: [] };

  const [recentNotesResult, pinnedNotesResult, labelRowsResult, reminderRowsResult, countsResult] = await Promise.all([
    supabase.from("notes").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null).order("updated_at", { ascending: false }).range(0, 7),
    supabase.from("notes").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null).eq("pinned", true).order("updated_at", { ascending: false }).range(0, 7),
    supabase.from("note_labels").select("label").eq("workspace_id", workspaceId).range(0, 299),
    supabase.from("note_reminders").select("*,note:notes(id,title,color,scope,visibility,pinned,archived_at)").eq("workspace_id", workspaceId).eq("status", "scheduled").order("remind_at", { ascending: true }).range(0, 11),
    Promise.all([
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null),
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).is("archived_at", null).eq("pinned", true),
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).not("archived_at", "is", null),
      supabase.from("note_reminders").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "scheduled"),
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).eq("scope", "personal"),
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).eq("scope", "workspace"),
    ]),
  ]);

  const labels = ((labelRowsResult.data ?? []) as Array<{ label: string }>).reduce<Record<string, number>>((map, row) => {
    map[row.label] = (map[row.label] ?? 0) + 1;
    return map;
  }, {});
  const labelsByNote = ((labelsByNoteResult.data ?? []) as Array<{ note_id: string; label: string }>).reduce<Record<string, string[]>>((map, row) => {
    map[row.note_id] = [...(map[row.note_id] ?? []), row.label];
    return map;
  }, {});

  return {
    notes,
    totalNotes: notesResult.count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((notesResult.count ?? 0) / pageSize)),
    labels: Object.entries(labels).sort(([left], [right]) => left.localeCompare(right)).map(([labelName, count]) => ({ label: labelName, count })),
    labelsByNote,
    recentNotes: (recentNotesResult.data ?? []) as NoteRecord[],
    pinnedNotes: (pinnedNotesResult.data ?? []) as NoteRecord[],
    reminders: (reminderRowsResult.data ?? []) as NotesListData["reminders"],
    counts: {
      active: countsResult[0].count ?? 0,
      pinned: countsResult[1].count ?? 0,
      archived: countsResult[2].count ?? 0,
      reminders: countsResult[3].count ?? 0,
      personal: countsResult[4].count ?? 0,
      workspace: countsResult[5].count ?? 0,
    },
  };
}

export async function getNoteDetail(noteId: string, workspaceId: string): Promise<NoteDetailData | null> {
  const supabase = await createClient();
  const [noteResult, labelsResult, linksResult, remindersResult, attachmentsResult, filesResult] = await Promise.all([
    supabase.from("notes").select("*").eq("workspace_id", workspaceId).eq("id", noteId).maybeSingle(),
    supabase.from("note_labels").select("*").eq("workspace_id", workspaceId).eq("note_id", noteId).order("label", { ascending: true }).range(0, 49),
    supabase.from("note_links").select("*").eq("workspace_id", workspaceId).eq("note_id", noteId).order("created_at", { ascending: false }).range(0, 49),
    supabase.from("note_reminders").select("*,note:notes(id,title,color,scope,visibility,pinned,archived_at),notification:notifications(id,title,body,kind,href,read_at,created_at)").eq("workspace_id", workspaceId).eq("note_id", noteId).order("remind_at", { ascending: false }).range(0, 19),
    supabase.from("note_attachments").select("*,file:drive_files(id,name,mime_type,size_bytes,upload_status)").eq("workspace_id", workspaceId).eq("note_id", noteId).order("created_at", { ascending: false }).range(0, 19),
    getDriveAttachableFiles(workspaceId),
  ]);

  const note = (noteResult.data as NoteRecord | null) ?? null;
  if (!note) return null;

  return {
    note,
    labels: (labelsResult.data ?? []) as NoteLabel[],
    links: (linksResult.data ?? []) as NoteLink[],
    reminders: (remindersResult.data ?? []) as NoteDetailData["reminders"],
    attachments: (attachmentsResult.data ?? []) as NoteDetailData["attachments"],
    attachableFiles: (filesResult ?? []) as NoteDetailData["attachableFiles"],
  };
}
