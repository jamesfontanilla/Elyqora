import type { NoteChecklistItem, NoteColor, NoteLinkTarget, NoteScope, NoteVisibility } from "@/lib/types";

export const NOTE_PAGE_SIZE = 24;
export const NOTE_PREVIEW_LIMIT = 220;
export const NOTE_LABEL_LIMIT = 40;
export const NOTE_TITLE_LIMIT = 180;
export const NOTE_BODY_LIMIT = 12000;
export const NOTE_CHECKLIST_ITEM_LIMIT = 30;
export const NOTE_REMINDER_WINDOW_DAYS = 30;

export const NOTE_COLORS: Array<{ value: NoteColor; label: string; className: string }> = [
  { value: "sand", label: "Sand", className: "bg-sand text-[#667878]" },
  { value: "mint", label: "Mint", className: "bg-mint text-moss" },
  { value: "coral", label: "Coral", className: "bg-[#fff1ed] text-coral" },
  { value: "sky", label: "Sky", className: "bg-[#eaf4ff] text-[#2f6eb5]" },
  { value: "amber", label: "Amber", className: "bg-[#fff6df] text-[#9a6a00]" },
  { value: "plum", label: "Plum", className: "bg-[#f5ecff] text-[#7d4f9e]" },
];

export const NOTE_LINK_TARGETS: Array<{ value: NoteLinkTarget; label: string }> = [
  { value: "project", label: "Project" },
  { value: "task", label: "Task" },
  { value: "contact", label: "Contact" },
  { value: "ticket", label: "Ticket" },
  { value: "event", label: "Event" },
  { value: "course", label: "Learning course" },
];

export const NOTE_SCOPES: Array<{ value: NoteScope; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "workspace", label: "Workspace" },
];

export const NOTE_VISIBILITIES: Array<{ value: NoteVisibility; label: string }> = [
  { value: "private", label: "Private" },
  { value: "workspace", label: "Workspace-visible" },
];

export function sanitizeNoteTitle(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, NOTE_TITLE_LIMIT) || "Untitled note";
}

export function sanitizeNoteBody(value: string) {
  return value.replace(/\u0000/g, "").slice(0, NOTE_BODY_LIMIT);
}

export function sanitizeNoteLabel(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, NOTE_LABEL_LIMIT);
}

export function parseNoteLabels(value: string | null | undefined) {
  return String(value ?? "")
    .split(/[,;\n]+/)
    .map((entry) => sanitizeNoteLabel(entry))
    .filter(Boolean);
}

export function formatNoteScope(scope: NoteScope) {
  return scope === "personal" ? "Personal" : "Workspace";
}

export function formatNoteVisibility(visibility: NoteVisibility) {
  return visibility === "private" ? "Private" : "Workspace-visible";
}

export function sanitizeNoteChecklistItems(value: unknown): NoteChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, NOTE_CHECKLIST_ITEM_LIMIT)
    .map((item, index) => {
      const entry = item as Partial<NoteChecklistItem>;
      return {
        id: typeof entry.id === "string" && entry.id ? entry.id : `${Date.now()}-${index}`,
        text: String(entry.text ?? "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
        checked: Boolean(entry.checked),
      };
    })
    .filter((item) => item.text.length > 0);
}

export function getNoteColorClass(value: NoteColor) {
  return NOTE_COLORS.find((entry) => entry.value === value)?.className ?? "bg-sand text-[#667878]";
}

export function getNoteExcerpt(body: string, checklistItems: NoteChecklistItem[]) {
  const checklistPreview = checklistItems
    .filter((item) => item.text)
    .slice(0, 2)
    .map((item) => `${item.checked ? "[x]" : "[ ]"} ${item.text}`)
    .join(" | ");
  const cleaned = body.replace(/[`*_>#\[\]]/g, "").replace(/\s+/g, " ").trim();
  return [cleaned, checklistPreview].filter(Boolean).join(" | ").slice(0, NOTE_PREVIEW_LIMIT);
}
