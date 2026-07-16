import type { TaskRecord, TaskRecurrenceRule } from "@/lib/types";

export interface TaskOccurrencePreview {
  start_date: string | null;
  due_date: string | null;
}

function toUtcDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(base: Date, months: number, dayOfMonth?: number | null) {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + months;
  const desiredDay = dayOfMonth ?? base.getUTCDate();
  const candidate = new Date(Date.UTC(year, month, 1));
  candidate.setUTCDate(Math.min(desiredDay, daysInUtcMonth(candidate.getUTCFullYear(), candidate.getUTCMonth())));
  return candidate;
}

function addYears(base: Date, years: number, dayOfMonth?: number | null) {
  return addMonths(base, years * 12, dayOfMonth);
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function weekdayMatches(date: Date, weekdays: number[]) {
  return weekdays.includes(date.getUTCDay());
}

function nextWeeklyCandidate(base: Date, interval: number, weekdays: number[]) {
  const start = addDays(base, 1);
  for (let offset = 0; offset < 4000; offset += 1) {
    const candidate = addDays(start, offset);
    const weeksSinceBase = Math.floor((candidate.getTime() - base.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksSinceBase % interval === 0 && weekdayMatches(candidate, weekdays)) return candidate;
  }
  return null;
}

function nextSimpleCandidate(base: Date, rule: TaskRecurrenceRule) {
  switch (rule.frequency) {
    case "daily":
      return addDays(base, rule.interval);
    case "weekly":
      return rule.weekdays?.length ? nextWeeklyCandidate(base, rule.interval, rule.weekdays) : addDays(base, rule.interval * 7);
    case "monthly":
      return addMonths(base, rule.interval, rule.day_of_month);
    case "yearly":
      return addYears(base, rule.interval, rule.day_of_month);
    default:
      return null;
  }
}

export function normalizeTaskRecurrenceRule(value: unknown): TaskRecurrenceRule | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<TaskRecurrenceRule>;
  if (!input.frequency || !["daily", "weekly", "monthly", "yearly"].includes(input.frequency)) return null;
  const interval = Number.isInteger(input.interval) ? Math.max(1, Math.min(3650, input.interval ?? 1)) : 1;
  const weekdays = Array.isArray(input.weekdays)
    ? [...new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : undefined;
  const dayOfMonth = Number.isInteger(input.day_of_month ?? NaN) ? Number(input.day_of_month) : null;
  const endDateValue = typeof input.end_date === "string" ? toUtcDate(input.end_date) : null;
  return {
    frequency: input.frequency,
    interval,
    weekdays,
    day_of_month: dayOfMonth,
    end_date: endDateValue ? formatDate(endDateValue) : null,
  };
}

export function calculateNextTaskOccurrence(task: Pick<TaskRecord, "start_date" | "due_date" | "recurrence_rule">, completedAt = new Date()): TaskOccurrencePreview | null {
  if (!task.recurrence_rule) return null;
  const rule = normalizeTaskRecurrenceRule(task.recurrence_rule);
  if (!rule) return null;
  const dueBase = toUtcDate(task.due_date ?? task.start_date ?? completedAt);
  if (!dueBase) return null;
  const nextDue = nextSimpleCandidate(dueBase, rule);
  if (!nextDue) return null;
  if (rule.end_date) {
    const endDate = toUtcDate(rule.end_date);
    if (!endDate || nextDue > endDate) return null;
  }

  let nextStart: Date | null = null;
  if (task.start_date && task.due_date) {
    const startBase = toUtcDate(task.start_date);
    const currentDue = toUtcDate(task.due_date);
    if (startBase && currentDue) {
      const durationDays = Math.max(0, Math.round((currentDue.getTime() - startBase.getTime()) / (24 * 60 * 60 * 1000)));
      nextStart = addDays(nextDue, -durationDays);
    }
  } else if (task.start_date) {
    nextStart = nextDue;
  }

  return {
    start_date: nextStart ? formatDate(nextStart) : null,
    due_date: formatDate(nextDue),
  };
}
