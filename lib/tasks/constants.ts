import type { TaskPriority, TaskRecurrenceFrequency, TaskScope, TaskStatus, TaskLinkTarget } from "@/lib/types";

export const TASK_PAGE_SIZE = 20;
export const TASK_TITLE_LIMIT = 180;
export const TASK_DESCRIPTION_LIMIT = 12000;
export const TASK_LABEL_LIMIT = 40;
export const TASK_COMMENT_LIMIT = 4000;
export const TASK_RECURRENCE_INTERVAL_LIMIT = 3650;

export const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; className: string }> = [
  { value: "todo", label: "To do", className: "bg-sand text-[#667878]" },
  { value: "in_progress", label: "In progress", className: "bg-[#eef8f3] text-moss" },
  { value: "blocked", label: "Blocked", className: "bg-[#fff4ec] text-coral" },
  { value: "completed", label: "Completed", className: "bg-mint text-moss" },
  { value: "canceled", label: "Canceled", className: "bg-[#f5f1ee] text-[#7f746c]" },
];

export const TASK_PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; className: string }> = [
  { value: "low", label: "Low", className: "bg-sand text-[#667878]" },
  { value: "medium", label: "Medium", className: "bg-[#eef8f3] text-moss" },
  { value: "high", label: "High", className: "bg-[#fff4ec] text-coral" },
  { value: "urgent", label: "Urgent", className: "bg-[#fdecea] text-coral" },
];

export const TASK_SCOPES: Array<{ value: TaskScope; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "workspace", label: "Workspace" },
];

export const TASK_RECURRING_FREQUENCIES: Array<{ value: TaskRecurrenceFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export const TASK_LINK_TARGETS: Array<{ value: TaskLinkTarget; label: string }> = [
  { value: "project", label: "Project" },
  { value: "contact", label: "Contact" },
  { value: "ticket", label: "Ticket" },
  { value: "event", label: "Event" },
  { value: "goal", label: "Goal" },
];

export function sanitizeTaskTitle(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, TASK_TITLE_LIMIT) || "Untitled task";
}

export function sanitizeTaskDescription(value: string) {
  return value.replace(/\u0000/g, "").trim().slice(0, TASK_DESCRIPTION_LIMIT);
}

export function sanitizeTaskLabel(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, TASK_LABEL_LIMIT);
}

export function parseTaskLabels(raw: string) {
  return raw
    .split(/[,\n;]/g)
    .map((value) => sanitizeTaskLabel(value))
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
    .slice(0, 12);
}

export function getTaskExcerpt(description: string, length = 180) {
  return description.replace(/[`*_>#\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, length);
}

export function formatTaskStatus(status: TaskStatus) {
  return status.replaceAll("_", " ");
}

export function formatTaskPriority(priority: TaskPriority) {
  return priority === "medium" ? "medium" : priority;
}

export function getTaskStatusClass(status: TaskStatus) {
  return TASK_STATUS_OPTIONS.find((option) => option.value === status)?.className ?? "bg-sand text-[#667878]";
}

export function getTaskPriorityClass(priority: TaskPriority) {
  return TASK_PRIORITY_OPTIONS.find((option) => option.value === priority)?.className ?? "bg-sand text-[#667878]";
}

export function isTaskOverdue(task: { due_date: string | null; status: TaskStatus; deleted_at?: string | null }) {
  if (!task.due_date || task.deleted_at || task.status === "completed" || task.status === "canceled") return false;
  const due = new Date(`${task.due_date}T23:59:59Z`).getTime();
  return !Number.isNaN(due) && due < Date.now();
}

export function formatTaskDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function formatTaskDate(value: string | null, fallback = "No date") {
  if (!value) return fallback;
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function makeTaskNotificationKey(kind: "assigned" | "reassigned" | "comment" | "overdue", taskId: string, suffix: string) {
  return `task-${kind}-${taskId}-${suffix}`;
}
