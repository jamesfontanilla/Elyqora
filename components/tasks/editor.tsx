"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Heading2, Link2, List, ListChecks, Quote, Save, Sparkles, SquareCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPreview } from "@/components/docs/markdown-preview";
import { TASK_PRIORITY_OPTIONS, TASK_RECURRING_FREQUENCIES, TASK_SCOPES, TASK_STATUS_OPTIONS, formatTaskDate, getTaskPriorityClass, getTaskStatusClass } from "@/lib/tasks/constants";
import { saveTaskDraftAction } from "@/lib/actions/tasks";
import { TaskCompleteForm } from "@/components/tasks/forms";
import type { TaskDraftInput } from "@/lib/actions/tasks";
import type { TaskPriority, TaskRecurrenceRule, TaskRecord, TaskScope, TaskStatus } from "@/lib/types";

type Member = { user_id: string; profile?: { full_name?: string | null; avatar_url?: string | null } | null };
type SaveState = "saved" | "typing" | "saving" | "error";
const WEEKDAY_OPTIONS: Array<[number, string]> = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
];

export function TaskEditor({ task, members, canEdit }: { task: TaskRecord; members: Member[]; canEdit: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState(task.title);
  const [descriptionMd, setDescriptionMd] = useState(task.description_md);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [scope, setScope] = useState<TaskScope>(task.scope);
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assignee_id);
  const [startDate, setStartDate] = useState<string | null>(task.start_date);
  const [dueDate, setDueDate] = useState<string | null>(task.due_date);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<TaskRecurrenceRule["frequency"] | "">(task.recurrence_rule?.frequency ?? "");
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(task.recurrence_rule?.interval ?? 1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>(task.recurrence_rule?.weekdays ?? []);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number | "">(task.recurrence_rule?.day_of_month ?? "");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(task.recurrence_rule?.end_date ?? "");
  const [revision, setRevision] = useState(task.revision);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveMessage, setSaveMessage] = useState(task.deleted_at ? "In the trash" : canEdit ? "Saved" : "Read only");
  const [draftDirty, setDraftDirty] = useState(false);
  const [preview, setPreview] = useState(false);

  const readOnly = !canEdit || Boolean(task.deleted_at);

  const recurrenceRule = useMemo<TaskRecurrenceRule | null>(() => {
    if (!recurrenceFrequency) return null;
    return {
      frequency: recurrenceFrequency,
      interval: Math.max(1, recurrenceInterval || 1),
      weekdays: recurrenceWeekdays.length > 0 ? recurrenceWeekdays : undefined,
      day_of_month: recurrenceDayOfMonth === "" ? null : recurrenceDayOfMonth,
      end_date: recurrenceEndDate || null,
    };
  }, [recurrenceDayOfMonth, recurrenceEndDate, recurrenceFrequency, recurrenceInterval, recurrenceWeekdays]);

  const currentDraft = useMemo<TaskDraftInput>(() => ({
    taskId: task.id,
    revision,
    title,
    descriptionMd,
    status,
    priority,
    scope,
    assigneeId: scope === "personal" ? null : assigneeId,
    startDate,
    dueDate,
    recurrenceRule,
    parentTaskId: task.parent_task_id,
  }), [assigneeId, descriptionMd, dueDate, recurrenceRule, revision, scope, startDate, status, task.id, task.parent_task_id, title, priority]);

  const saveDraft = useCallback(async () => {
    if (readOnly) return;
    try {
      setSaveState("saving");
      setSaveMessage("Saving task...");
      const result = await saveTaskDraftAction(currentDraft);
      if (!result.ok) {
        setSaveState("error");
        setSaveMessage(result.error ?? "The task could not be saved.");
        if (result.conflict && result.revision) setRevision(result.revision);
        return;
      }
      setRevision(result.revision ?? revision + 1);
      setDraftDirty(false);
      setSaveState("saved");
      setSaveMessage(result.nextTaskId ? "Saved and next occurrence created." : `Saved ${new Date(result.savedAt ?? Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "The task could not be saved.");
    }
  }, [currentDraft, readOnly, revision]);

  useEffect(() => {
    if (!draftDirty || readOnly) return;
    setSaveState("typing");
    setSaveMessage("Unsaved changes");
    const timer = window.setTimeout(() => { void saveDraft(); }, 850);
    return () => window.clearTimeout(timer);
  }, [draftDirty, readOnly, saveDraft]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (draftDirty || saveState === "saving" || saveState === "typing") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draftDirty, saveState]);

  function markDirty() {
    if (readOnly) return;
    setDraftDirty(true);
    if (saveState !== "saving") {
      setSaveState("typing");
      setSaveMessage("Unsaved changes");
    }
  }

  function insertMarkdown(prefix: string, suffix = "", placeholder = "") {
    if (readOnly) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? descriptionMd.length;
    const end = textarea.selectionEnd ?? descriptionMd.length;
    const selected = descriptionMd.slice(start, end) || placeholder;
    const next = `${descriptionMd.slice(0, start)}${prefix}${selected}${suffix}${descriptionMd.slice(end)}`;
    setDescriptionMd(next);
    markDirty();
    window.requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveDraft();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      setPreview((current) => !current);
    }
  }

  function toggleWeekday(day: number) {
    setRecurrenceWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((left, right) => left - right));
    markDirty();
  }

  const toolbarButtons = [
    { label: "Heading", icon: <Heading2 size={15} />, action: () => insertMarkdown("## ") },
    { label: "List", icon: <List size={15} />, action: () => insertMarkdown("- ") },
    { label: "Checklist", icon: <ListChecks size={15} />, action: () => insertMarkdown("- [ ] ") },
    { label: "Quote", icon: <Quote size={15} />, action: () => insertMarkdown("> ") },
    { label: "Code block", icon: <SquareCode size={15} />, action: () => insertMarkdown("```\n", "\n```", "code") },
    { label: "Link", icon: <Link2 size={15} />, action: () => insertMarkdown("[", "](https://example.com)", "link text") },
  ];

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
                  aria-label="Task title"
                  disabled={readOnly}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className={getTaskStatusClass(status)}>{status.replaceAll("_", " ")}</Badge>
                  <Badge className={getTaskPriorityClass(priority)}>{priority}</Badge>
                  <Badge className={scope === "personal" ? "bg-sand text-[#667878]" : "bg-mint text-moss"}>{scope}</Badge>
                  {task.deleted_at && <Badge className="bg-[#fff0ef] text-coral">In trash</Badge>}
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
                {!readOnly && status !== "completed" && <TaskCompleteForm taskId={task.id}><Sparkles size={15} className="mr-1.5" />Complete</TaskCompleteForm>}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold text-[#667878]">
                Status
                <Select value={status} onChange={(event) => { setStatus(event.target.value as TaskStatus); markDirty(); }} disabled={readOnly} aria-label="Task status">
                  {TASK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-[#667878]">
                Priority
                <Select value={priority} onChange={(event) => { setPriority(event.target.value as TaskPriority); markDirty(); }} disabled={readOnly} aria-label="Task priority">
                  {TASK_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Description</h2>
              <p className="mt-1 text-xs text-[#8a9992]">Ctrl/Cmd + S saves. Ctrl/Cmd + Enter toggles preview.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[var(--line)] bg-sand/30 p-1">
              {toolbarButtons.map((button) => (
                <Button key={button.label} type="button" variant="ghost" className="min-h-8 px-2 text-xs" onClick={button.action} disabled={readOnly} aria-label={button.label}>
                  {button.icon}
                </Button>
              ))}
            </div>
          </div>
          {preview ? (
            <div className="min-h-[340px] rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-8">
              <MarkdownPreview content={descriptionMd} />
            </div>
          ) : (
            <Textarea
              ref={textareaRef}
              value={descriptionMd}
              onChange={(event) => { setDescriptionMd(event.target.value); markDirty(); }}
              onKeyDown={handleEditorKeyDown}
              disabled={readOnly}
              className="min-h-[340px] rounded-2xl border-[var(--line)] bg-white p-4 font-mono text-sm leading-7 text-ink shadow-none"
              placeholder="Capture the task, the outcome, or the next small step."
              aria-label="Task description"
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-xl font-semibold text-ink">Scheduling</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold text-[#667878]">
                Scope
                <Select value={scope} onChange={(event) => { const next = event.target.value as TaskScope; setScope(next); if (next === "personal") setAssigneeId(null); markDirty(); }} disabled={readOnly} aria-label="Task scope">
                  {TASK_SCOPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-[#667878]">
                Assignee
                <Select value={assigneeId ?? ""} onChange={(event) => { setAssigneeId(event.target.value || null); markDirty(); }} disabled={readOnly || scope === "personal"} aria-label="Task assignee">
                  <option value="">No assignee</option>
                  {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}
                </Select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-xs font-semibold text-[#667878]">
                Start date
                <Input type="date" value={startDate ?? ""} onChange={(event) => { setStartDate(event.target.value || null); markDirty(); }} disabled={readOnly} aria-label="Start date" />
              </label>
              <label className="space-y-2 text-xs font-semibold text-[#667878]">
                Due date
                <Input type="date" value={dueDate ?? ""} onChange={(event) => { setDueDate(event.target.value || null); markDirty(); }} disabled={readOnly} aria-label="Due date" />
              </label>
            </div>
            <div className="mt-3 rounded-2xl bg-sand/30 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-2 text-xs font-semibold text-[#667878]">
                  Recurrence
                  <Select value={recurrenceFrequency} onChange={(event) => { setRecurrenceFrequency(event.target.value as TaskRecurrenceRule["frequency"] | ""); markDirty(); }} disabled={readOnly} aria-label="Recurrence frequency">
                    <option value="">None</option>
                    {TASK_RECURRING_FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </label>
                <label className="space-y-2 text-xs font-semibold text-[#667878]">
                  Interval
                  <Input type="number" min="1" max="3650" value={recurrenceInterval} onChange={(event) => { setRecurrenceInterval(Number.parseInt(event.target.value, 10) || 1); markDirty(); }} disabled={readOnly} aria-label="Recurrence interval" />
                </label>
                <label className="space-y-2 text-xs font-semibold text-[#667878]">
                  Day of month
                  <Input type="number" min="1" max="31" value={recurrenceDayOfMonth} onChange={(event) => { setRecurrenceDayOfMonth(event.target.value ? Number.parseInt(event.target.value, 10) || "" : ""); markDirty(); }} disabled={readOnly} aria-label="Recurrence day of month" />
                </label>
                <label className="space-y-2 text-xs font-semibold text-[#667878]">
                  End date
                  <Input type="date" value={recurrenceEndDate} onChange={(event) => { setRecurrenceEndDate(event.target.value); markDirty(); }} disabled={readOnly} aria-label="Recurrence end date" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map(([day, label]) => (
                  <button
                    key={day}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={recurrenceWeekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                    className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition ${recurrenceWeekdays.includes(day) ? "bg-mint text-moss" : "border border-[var(--line)] bg-white text-[#667878] hover:bg-sand"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
            <p className="eyebrow">Task at a glance</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#667878]">Revision</span>
                <span className="font-semibold text-ink">{revision}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#667878]">State</span>
                <span className="font-semibold text-ink">{task.deleted_at ? "Trash" : task.status}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#667878]">Due</span>
              <span className="font-semibold text-ink">{formatTaskDate(dueDate, "No due date")}</span>
              </div>
            </div>

            {readOnly && (
              <div className="mt-4 rounded-2xl bg-sand/40 p-4 text-sm leading-6 text-[#667878]">
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <Sparkles size={16} className="text-moss" />
                  Read-only task
                </div>
                <p className="mt-2">{task.deleted_at ? "Restore this task from the trash to edit it again." : "You can read this task, but this account does not have edit access."}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
