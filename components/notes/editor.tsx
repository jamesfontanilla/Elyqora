"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Pin, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { MarkdownPreview } from "@/components/docs/markdown-preview";
import { saveNoteDraftAction } from "@/lib/actions/notes";
import { NOTE_COLORS, NOTE_SCOPES, NOTE_VISIBILITIES, formatNoteScope, formatNoteVisibility } from "@/lib/notes/constants";
import type { NoteChecklistItem, NoteColor, NoteRecord, NoteScope, NoteVisibility } from "@/lib/types";

type SaveState = "saved" | "typing" | "saving" | "error";

export function NoteEditor({ note, canEdit }: { note: NoteRecord; canEdit: boolean }) {
  const [title, setTitle] = useState(note.title);
  const [bodyMd, setBodyMd] = useState(note.body_md);
  const [checklistItems, setChecklistItems] = useState<NoteChecklistItem[]>(note.checklist_items ?? []);
  const [color, setColor] = useState<NoteColor>(note.color);
  const [scope, setScope] = useState<NoteScope>(note.scope);
  const [visibility, setVisibility] = useState<NoteVisibility>(note.visibility);
  const [pinned, setPinned] = useState(note.pinned);
  const [revision, setRevision] = useState(note.revision);
  const [preview, setPreview] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(canEdit && !note.deleted_at ? "saved" : "saved");
  const [saveMessage, setSaveMessage] = useState(canEdit && !note.deleted_at ? "Saved" : note.deleted_at ? "In the trash" : "Read only");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(note.updated_at);
  const saveCounter = useRef(0);

  const readOnly = !canEdit || Boolean(note.deleted_at);
  const currentDraft = useMemo(() => ({ title, bodyMd, checklistItems, color, scope, visibility, pinned }), [bodyMd, checklistItems, color, pinned, scope, title, visibility]);

  const saveDraft = useCallback(async () => {
    if (!canEdit || note.deleted_at) return;
    const attempt = ++saveCounter.current;
    setSaveState("saving");
    setSaveMessage("Saving note…");
    const result = await saveNoteDraftAction({
      noteId: note.id,
      revision,
      ...currentDraft,
    });
    if (attempt !== saveCounter.current) return;
    if (!result.ok) {
      setSaveState("error");
      setSaveMessage(result.error ?? "The note could not be saved.");
      return;
    }
    const savedAt = result.savedAt ?? new Date().toISOString();
    setRevision(result.revision ?? revision + 1);
    setDraftDirty(false);
    setSaveState("saved");
    setLastSavedAt(savedAt);
    setSaveMessage(`Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  }, [canEdit, currentDraft, note.deleted_at, note.id, revision]);

  useEffect(() => {
    if (!canEdit || note.deleted_at || !draftDirty) return;
    setSaveState("typing");
    setSaveMessage("Unsaved changes");
    const timer = window.setTimeout(() => {
      void saveDraft();
    }, 850);
    return () => window.clearTimeout(timer);
  }, [canEdit, draftDirty, note.deleted_at, saveDraft]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if ((canEdit && draftDirty) || saveState === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [canEdit, draftDirty, saveState]);

  function markDirty() {
    if (readOnly) return;
    setDraftDirty(true);
    if (saveState !== "saving") {
      setSaveState("typing");
      setSaveMessage("Unsaved changes");
    }
  }

  function insertChecklistItem() {
    if (readOnly) return;
    setChecklistItems((items) => [...items, { id: getItemId(), text: "", checked: false }]);
    markDirty();
  }

  function updateChecklistItem(id: string, patch: Partial<NoteChecklistItem>) {
    if (readOnly) return;
    setChecklistItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)).filter((item) => item.text || item.id === id));
    markDirty();
  }

  function removeChecklistItem(id: string) {
    if (readOnly) return;
    setChecklistItems((items) => items.filter((item) => item.id !== id));
    markDirty();
  }

  function setScopeAndVisibility(nextScope: NoteScope) {
    if (readOnly) return;
    setScope(nextScope);
    if (nextScope === "personal") setVisibility("private");
    markDirty();
  }

  function togglePinned() {
    if (readOnly) return;
    setPinned((current) => !current);
    markDirty();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  value={title}
                  onChange={(event) => { setTitle(event.target.value); markDirty(); }}
                  className="border-0 bg-transparent px-0 font-display text-3xl font-semibold shadow-none sm:text-4xl"
                  aria-label="Note title"
                  disabled={readOnly}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className={scope === "personal" ? "bg-sand text-[#667878]" : "bg-mint text-moss"}>{formatNoteScope(scope)}</Badge>
                  <Badge className={visibility === "private" ? "bg-sand text-[#667878]" : "bg-mint text-moss"}>{formatNoteVisibility(visibility)}</Badge>
                  {pinned && <Badge className="bg-[#eef8f3] text-moss">Pinned</Badge>}
                  {note.deleted_at && <Badge className="bg-[#fff0ef] text-coral">In trash</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#667878]">
                <span className={saveState === "error" ? "text-coral" : saveState === "saved" ? "text-moss" : "text-[#8a9992]"}>{saveMessage}</span>
                <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => void saveDraft()} disabled={readOnly}>
                  <Save size={15} className="mr-1.5" />
                  Save
                </Button>
                <Button type="button" variant={preview ? "primary" : "ghost"} className="min-h-9 px-3" onClick={() => setPreview((current) => !current)}>
                  <Eye size={15} className="mr-1.5" />
                  {preview ? "Edit" : "Preview"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {NOTE_COLORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={color === option.value}
                  onClick={() => { if (readOnly) return; setColor(option.value); markDirty(); }}
                  className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition ${color === option.value ? option.className : "border border-[var(--line)] bg-white text-[#667878] hover:bg-sand"}`}
                >
                  {option.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={togglePinned} disabled={readOnly}>
                  <Pin size={14} className="mr-1.5" />
                  {pinned ? "Unpin" : "Pin"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">Markdown body</h2>
              <span className="text-xs text-[#8a9992]">{lastSavedAt ? `Updated ${new Date(lastSavedAt).toLocaleDateString()}` : "Draft"}</span>
            </div>
            {preview ? (
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-sand/20 p-4">
                <MarkdownPreview content={bodyMd} />
              </div>
            ) : (
                <Textarea
                value={bodyMd}
                onChange={(event) => { setBodyMd(event.target.value); markDirty(); }}
                disabled={readOnly}
                className="mt-4 min-h-[340px] rounded-2xl border-[var(--line)] bg-white p-4 font-mono text-sm leading-7 text-ink shadow-none"
                placeholder="Capture the thought, the task, or the little thread you do not want to lose."
                aria-label="Markdown body"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void saveDraft();
                  }
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    setPreview((current) => !current);
                  }
                }}
              />
            )}
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">Checklist</h2>
              <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={insertChecklistItem} disabled={readOnly}>
                <Plus size={14} className="mr-1.5" />
                Add item
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {checklistItems.length === 0 ? (
                <div className="rounded-2xl bg-sand/50 p-4 text-sm text-[#667878]">No checklist items yet. Add one for a small next step.</div>
              ) : checklistItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => updateChecklistItem(item.id, { checked: event.target.checked })}
                    disabled={readOnly}
                    className="mt-2 h-4 w-4 rounded border-[var(--line)] text-moss"
                    aria-label={`Mark ${item.text || "item"} complete`}
                  />
                  <Input
                    value={item.text}
                    onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                    disabled={readOnly}
                    placeholder="Checklist item"
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" className="min-h-9 px-2 text-coral" onClick={() => removeChecklistItem(item.id)} disabled={readOnly}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
          <p className="eyebrow">About this note</p>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#667878]">Scope</span>
              <Select value={scope} onChange={(event) => setScopeAndVisibility(event.target.value as NoteScope)} disabled={readOnly} className="w-auto min-w-36">
                {NOTE_SCOPES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#667878]">Visibility</span>
              <Select value={visibility} onChange={(event) => { setVisibility(event.target.value as NoteVisibility); markDirty(); }} disabled={readOnly || scope === "personal"} className="w-auto min-w-36">
                {NOTE_VISIBILITIES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#667878]">Revision</span>
              <span className="font-semibold text-ink">{revision}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#667878]">State</span>
              <span className="font-semibold text-ink">{note.deleted_at ? "Trash" : note.archived_at ? "Archived" : "Active"}</span>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="rounded-3xl border border-[var(--line)] bg-sand/40 p-4 text-sm leading-6 text-[#667878]">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Sparkles size={16} className="text-moss" />
              Read-only note
            </div>
            <p className="mt-2">{note.deleted_at ? "Restore this note from the trash to edit it again." : "You can read this note, but this account does not have edit access."}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function getItemId() {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
