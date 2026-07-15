"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Heading2, List, ListChecks, Quote, Save, SquareCode } from "lucide-react";
import { saveDocumentDraftAction, saveDocumentVersionAction } from "@/lib/actions/docs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MarkdownPreview } from "@/components/docs/markdown-preview";
import type { DocumentRecord } from "@/lib/types";

export function DocumentEditor({ document }: { document: DocumentRecord }) {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content_md);
  const [visibility, setVisibility] = useState(document.visibility);
  const [status, setStatus] = useState(document.status);
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "typing" | "saving" | "error">("saved");
  const [saveMessage, setSaveMessage] = useState("Saved");
  const [draftDirty, setDraftDirty] = useState(false);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const initialRender = useRef(true);
  const latestDraft = useRef({ title, content });
  const dirty = draftDirty || metadataDirty;

  useEffect(() => {
    latestDraft.current = { title, content };
  }, [content, title]);

  useEffect(() => {
    if (initialRender.current) { initialRender.current = false; return; }
    if (!draftDirty) return;
    setSaveState("typing");
    setSaveMessage("Saving draft soon…");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      setSaveMessage("Saving draft…");
      const result = await saveDocumentDraftAction({ documentId: document.id, title, contentMd: content });
      if (latestDraft.current.title !== title || latestDraft.current.content !== content) return;
      if (result.ok) { setSaveState("saved"); setSaveMessage(`Saved ${new Date(result.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`); setDraftDirty(false); }
      else { setSaveState("error"); setSaveMessage(result.error); }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [content, title, draftDirty, document.id]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { if (dirty || saveState === "saving" || saveState === "typing") { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty, saveState]);

  function updateContent(value: string) { setContent(value); setDraftDirty(true); }
  function insertMarkdown(prefix: string, suffix = "") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || "text";
    const next = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
    updateContent(next);
    window.requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"><section className="min-w-0 space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Input value={title} onChange={(event) => { setTitle(event.target.value); setDraftDirty(true); }} className="border-0 bg-transparent px-0 font-display text-3xl font-semibold shadow-none sm:text-4xl" aria-label="Document title" /><div className="flex items-center gap-2 text-xs text-[#667878]"><span className={saveState === "error" ? "text-coral" : saveState === "saved" ? "text-moss" : "text-[#8a9992]"}>{saveMessage}</span><Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => formRef.current?.requestSubmit()}><Save size={15} className="mr-1.5" />Save version</Button></div></div><div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-white p-2"><ToolbarButton label="Heading" onClick={() => insertMarkdown("## ")}><Heading2 size={15} /></ToolbarButton><ToolbarButton label="Bold" onClick={() => insertMarkdown("**", "**")}><strong>B</strong></ToolbarButton><ToolbarButton label="List" onClick={() => insertMarkdown("- ")}><List size={15} /></ToolbarButton><ToolbarButton label="Checklist" onClick={() => insertMarkdown("- [ ] ")}><ListChecks size={15} /></ToolbarButton><ToolbarButton label="Quote" onClick={() => insertMarkdown("> ")}><Quote size={15} /></ToolbarButton><ToolbarButton label="Code" onClick={() => insertMarkdown("```\n", "\n```")}><SquareCode size={15} /></ToolbarButton><ToolbarButton label="Link" onClick={() => insertMarkdown("[", "](https://example.com)")}>↗</ToolbarButton><span className="mx-1 h-5 w-px bg-[var(--line)]" /><Button type="button" variant={preview ? "primary" : "ghost"} className="min-h-8 px-2 text-xs" onClick={() => setPreview((current) => !current)}><Eye size={15} className="mr-1.5" />{preview ? "Edit" : "Preview"}</Button></div>{preview ? <div className="min-h-[520px] rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-8"><MarkdownPreview content={content} /></div> : <textarea ref={textareaRef} value={content} onChange={(event) => updateContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); formRef.current?.requestSubmit(); } if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); setPreview(true); } }} className="focus-ring min-h-[560px] w-full resize-y rounded-2xl border border-[var(--line)] bg-white p-5 font-mono text-sm leading-7 text-ink shadow-none sm:p-8" placeholder="# Start writing…" aria-label="Markdown document editor" />}<form ref={formRef} action={async (formData) => { const state = await saveDocumentVersionAction({}, formData); if (state.error) { setSaveState("error"); setSaveMessage(state.error); } else { setSaveState("saved"); setSaveMessage(state.message ?? "Version saved"); setDraftDirty(false); setMetadataDirty(false); } }} className="hidden"><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="title" value={title} /><input type="hidden" name="contentMd" value={content} /><input type="hidden" name="visibility" value={visibility} /><input type="hidden" name="status" value={status} /></form></section><aside className="space-y-4"><div className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="eyebrow">Publishing</p><label className="mt-3 block text-xs font-semibold text-[#667878]">Visibility<Select value={visibility} onChange={(event) => { setVisibility(event.target.value as typeof visibility); setMetadataDirty(true); setSaveState("typing"); setSaveMessage("Unsaved publishing changes"); }} className="mt-1"><option value="private">Private</option><option value="workspace">Workspace-visible</option><option value="public">Public read-only</option></Select></label><label className="mt-3 block text-xs font-semibold text-[#667878]">Status<Select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setMetadataDirty(true); setSaveState("typing"); setSaveMessage("Unsaved publishing changes"); }} className="mt-1"><option value="draft">Draft</option><option value="published">Published</option></Select></label><p className="mt-3 text-xs leading-5 text-[#8a9992]">Public documents only appear through their published, read-only link.</p></div><div className="rounded-2xl border border-[var(--line)] bg-sand/40 p-4 text-xs leading-5 text-[#667878]"><p className="font-semibold text-ink">Shortcuts</p><p className="mt-2">Ctrl/Cmd + S saves a version.</p><p>Ctrl/Cmd + Enter toggles preview.</p><p>Drafts autosave after a short pause.</p></div></aside></div>;
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <Button type="button" variant="ghost" className="min-h-8 gap-1.5 px-2 text-xs" aria-label={label} onClick={onClick}>{children}</Button>; }
