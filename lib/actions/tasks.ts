"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { getMembership, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  TASK_COMMENT_LIMIT,
  TASK_DESCRIPTION_LIMIT,
  TASK_PRIORITY_OPTIONS,
  TASK_RECURRENCE_INTERVAL_LIMIT,
  TASK_STATUS_OPTIONS,
  TASK_TITLE_LIMIT,
  parseTaskLabels,
  sanitizeTaskDescription,
  sanitizeTaskTitle,
} from "@/lib/tasks/constants";
import { calculateNextTaskOccurrence, normalizeTaskRecurrenceRule } from "@/lib/tasks/recurrence";
import type { TaskLinkTarget, TaskPriority, TaskRecord, TaskRecurrenceRule, TaskScope, TaskStatus } from "@/lib/types";

const uuid = z.string().uuid();
const taskPriorityEnum = z.enum(TASK_PRIORITY_OPTIONS.map((option) => option.value) as [TaskPriority, ...TaskPriority[]]);
const taskStatusEnum = z.enum(TASK_STATUS_OPTIONS.map((option) => option.value) as [TaskStatus, ...TaskStatus[]]);
const taskScopeEnum = z.enum(["personal", "workspace"]);

export interface TaskDraftInput {
  taskId: string;
  revision: number;
  title: string;
  descriptionMd: string;
  status: TaskStatus;
  priority: TaskPriority;
  scope: TaskScope;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  recurrenceRule: TaskRecurrenceRule | null;
  parentTaskId?: string | null;
}

export interface TaskDraftResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
  revision?: number;
  conflict?: boolean;
  nextTaskId?: string;
}

async function ensureWorkspaceMember(workspaceId: string) {
  const user = await requireUser();
  const membership = await getMembership(workspaceId, user.id);
  if (!membership || membership.status !== "active") throw new Error("You need access to this workspace.");
  const supabase = await createClient();
  return { user, membership, supabase };
}

async function ensureWorkspacePermission(workspaceId: string, permission: "tasks.read" | "tasks.write" | "tasks.manage") {
  const { user, membership, supabase } = await ensureWorkspaceMember(workspaceId);
  const { data: allowed, error } = await supabase.rpc("has_workspace_permission", { target_workspace_id: workspaceId, required_permission: permission });
  if (error || !allowed) throw new Error("You do not have permission to manage tasks in this workspace.");
  return { user, membership, supabase };
}

async function loadTaskRecord(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!task) throw new Error("Task not found or no longer available.");
  return { supabase, task: task as TaskRecord };
}

async function loadEditableTask(taskId: string) {
  const user = await requireUser();
  const { supabase, task } = await loadTaskRecord(taskId);
  const { data: allowed, error } = await supabase.rpc("can_edit_task", { target_task_id: taskId });
  if (error || !allowed) throw new Error("You do not have permission to change this task.");
  return { user, supabase, task };
}

async function loadManageableTask(taskId: string) {
  const user = await requireUser();
  const { supabase, task } = await loadTaskRecord(taskId);
  const { data: allowed, error } = await supabase.rpc("can_manage_task", { target_task_id: taskId });
  if (error || !allowed) throw new Error("You do not have permission to manage this task.");
  return { user, supabase, task };
}

async function recordTaskAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  action: string,
  taskId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.rpc("record_audit_event", {
    target_workspace_id: workspaceId,
    event_action: action,
    event_entity_type: "task",
    event_entity_id: taskId,
    event_metadata: metadata,
  });
}

function revalidateTasks(taskId?: string | null) {
  const taskPath = taskId ? [`/tasks/${taskId}`] : [];
  for (const path of ["/tasks", "/tasks/board", "/tasks/calendar", "/tasks/mine", "/tasks/overdue", "/tasks/completed", ...taskPath]) {
    revalidatePath(path);
  }
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function parseOptionalUuid(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? uuid.safeParse(raw) : { success: true as const, data: null };
}

function parseRecurrenceRule(formData: FormData) {
  const frequencyValue = String(formData.get("recurrenceFrequency") ?? "").trim();
  if (!frequencyValue) return null;
  const frequency = z.enum(["daily", "weekly", "monthly", "yearly"]).safeParse(frequencyValue);
  const intervalRaw = Number.parseInt(String(formData.get("recurrenceInterval") ?? "1"), 10);
  const weekdays = formData.getAll("recurrenceWeekdays").map((value) => Number.parseInt(String(value), 10)).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const endDate = parseOptionalDate(formData.get("recurrenceEndDate"));
  const dayOfMonthRaw = Number.parseInt(String(formData.get("recurrenceDayOfMonth") ?? ""), 10);
  if (!frequency.success) return null;
  return normalizeTaskRecurrenceRule({
    frequency: frequency.data,
    interval: Number.isFinite(intervalRaw) ? Math.max(1, Math.min(TASK_RECURRENCE_INTERVAL_LIMIT, intervalRaw)) : 1,
    weekdays: weekdays.length ? weekdays : undefined,
    day_of_month: Number.isFinite(dayOfMonthRaw) && dayOfMonthRaw > 0 && dayOfMonthRaw <= 31 ? dayOfMonthRaw : null,
    end_date: endDate,
  });
}

async function ensureValidAssignee(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, assigneeId: string | null) {
  if (!assigneeId) return null;
  const { data } = await supabase.from("memberships").select("user_id").eq("workspace_id", workspaceId).eq("user_id", assigneeId).eq("status", "active").maybeSingle();
  return data ? assigneeId : null;
}

async function ensureTaskParent(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, parentTaskId: string | null) {
  if (!parentTaskId) return null;
  const { data } = await supabase.from("tasks").select("id").eq("workspace_id", workspaceId).eq("id", parentTaskId).is("deleted_at", null).maybeSingle();
  return data ? parentTaskId : null;
}

async function replaceTaskLabels(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, taskId: string, userId: string, labels: string[]) {
  await supabase.from("task_labels").delete().eq("workspace_id", workspaceId).eq("task_id", taskId);
  if (labels.length === 0) return;
  await supabase.from("task_labels").insert(labels.map((label) => ({ workspace_id: workspaceId, task_id: taskId, label, created_by: userId })));
}

async function cloneRecurringTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  task: TaskRecord,
  completedBy: string,
) {
  const next = calculateNextTaskOccurrence(task);
  if (!next) return null;
  const existing = await supabase.from("tasks").select("id").eq("workspace_id", task.workspace_id).eq("series_id", task.series_id).eq("recurrence_occurrence", task.recurrence_occurrence + 1).is("deleted_at", null).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const { data: clonedTask, error } = await supabase.from("tasks").insert({
    workspace_id: task.workspace_id,
    parent_task_id: task.parent_task_id,
    series_id: task.series_id,
    recurrence_rule: task.recurrence_rule,
    recurrence_occurrence: task.recurrence_occurrence + 1,
    title: task.title,
    description_md: task.description_md,
    status: "todo",
    priority: task.priority,
    scope: task.scope,
    assignee_id: task.scope === "personal" ? null : task.assignee_id,
    start_date: next.start_date,
    due_date: next.due_date,
    completed_at: null,
    completed_by: null,
    created_by: completedBy,
    updated_by: completedBy,
    revision: 1,
  }).select("id").single();
  if (error || !clonedTask?.id) return null;

  const [labels, links, attachments] = await Promise.all([
    supabase.from("task_labels").select("label").eq("workspace_id", task.workspace_id).eq("task_id", task.id),
    supabase.from("task_links").select("target_type,target_id").eq("workspace_id", task.workspace_id).eq("task_id", task.id),
    supabase.from("task_attachments").select("file_id").eq("workspace_id", task.workspace_id).eq("task_id", task.id),
  ]);

  const nextTaskId = clonedTask.id as string;
  const labelRows = (labels.data ?? []) as Array<{ label: string }>;
  const linkRows = (links.data ?? []) as Array<{ target_type: TaskLinkTarget; target_id: string }>;
  const attachmentRows = (attachments.data ?? []) as Array<{ file_id: string }>;
  if (labelRows.length > 0) {
    await supabase.from("task_labels").insert(labelRows.map((row) => ({ workspace_id: task.workspace_id, task_id: nextTaskId, label: row.label, created_by: completedBy })));
  }
  if (linkRows.length > 0) {
    await supabase.from("task_links").insert(linkRows.map((row) => ({ workspace_id: task.workspace_id, task_id: nextTaskId, target_type: row.target_type, target_id: row.target_id, created_by: completedBy })));
  }
  if (attachmentRows.length > 0) {
    await supabase.from("task_attachments").insert(attachmentRows.map((row) => ({ workspace_id: task.workspace_id, task_id: nextTaskId, file_id: row.file_id, created_by: completedBy })));
  }

  return nextTaskId;
}

async function completeTaskByRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  task: TaskRecord,
  userId: string,
) {
  if (task.status === "completed") return { completed: false as const, nextTaskId: null as string | null };
  const nextStatus = "completed" as const;
  const completedAt = new Date().toISOString();
  const payload = {
    status: nextStatus,
    completed_at: completedAt,
    completed_by: userId,
    updated_by: userId,
    revision: task.revision + 1,
  };
  const { error } = await supabase.from("tasks").update(payload).eq("id", task.id).eq("revision", task.revision);
  if (error) throw new Error(error.message);
  const completedTask: TaskRecord = { ...task, ...payload, status: nextStatus, completed_at: completedAt, completed_by: userId, updated_at: completedAt };
  const nextTaskId = await cloneRecurringTask(supabase, completedTask, userId);
  return { completed: true as const, nextTaskId };
}

async function softDeleteTaskTree(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, taskIds: string[], deletedBy: string) {
  const seen = new Set(taskIds);
  let frontier = [...taskIds];
  for (let depth = 0; depth < 10 && frontier.length > 0; depth += 1) {
    const { data } = await supabase.from("tasks").select("id").eq("workspace_id", workspaceId).in("parent_task_id", frontier).is("deleted_at", null).range(0, 199);
    const next = (data ?? []).map((row) => row.id as string).filter((id) => !seen.has(id));
    next.forEach((id) => seen.add(id));
    frontier = next;
  }
  const allIds = [...seen];
  if (allIds.length === 0) return 0;
  await supabase.from("tasks").update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy, updated_by: deletedBy }).eq("workspace_id", workspaceId).in("id", allIds);
  return allIds.length;
}

async function restoreTaskTree(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, taskId: string, restoredBy: string) {
  const seen = new Set([taskId]);
  let frontier = [taskId];
  for (let depth = 0; depth < 10 && frontier.length > 0; depth += 1) {
    const { data } = await supabase.from("tasks").select("id").eq("workspace_id", workspaceId).in("parent_task_id", frontier).not("deleted_at", "is", null).range(0, 199);
    const next = (data ?? []).map((row) => row.id as string).filter((id) => !seen.has(id));
    next.forEach((id) => seen.add(id));
    frontier = next;
  }
  const allIds = [...seen];
  await supabase.from("tasks").update({ deleted_at: null, deleted_by: null, updated_by: restoredBy }).eq("workspace_id", workspaceId).in("id", allIds);
}

async function refreshOverdueNotifications(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string) {
  const { error } = await supabase.rpc("refresh_task_overdue_notifications", { target_workspace_id: workspaceId });
  if (error) throw new Error(error.message);
}

export async function createTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const title = z.string().trim().min(1, "Enter a task title.").max(TASK_TITLE_LIMIT).safeParse(formData.get("title"));
  const descriptionMd = z.string().max(TASK_DESCRIPTION_LIMIT).safeParse(String(formData.get("descriptionMd") ?? ""));
  const status = taskStatusEnum.safeParse(String(formData.get("status") ?? "todo"));
  const priority = taskPriorityEnum.safeParse(String(formData.get("priority") ?? "medium"));
  const scope = taskScopeEnum.safeParse(String(formData.get("scope") ?? "workspace"));
  const assigneeId = parseOptionalUuid(formData.get("assigneeId"));
  const parentTaskId = parseOptionalUuid(formData.get("parentTaskId"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const dueDate = parseOptionalDate(formData.get("dueDate"));
  if (!workspaceId.success || !title.success || !descriptionMd.success || !status.success || !priority.success || !scope.success || !assigneeId.success || !parentTaskId.success) {
    return { error: "Check the task details before creating it." };
  }

  try {
    const { user, supabase } = await ensureWorkspaceMember(workspaceId.data);
    if (scope.data === "workspace") {
      const { data: canWrite } = await supabase.rpc("has_workspace_permission", { target_workspace_id: workspaceId.data, required_permission: "tasks.write" });
      if (!canWrite) return { error: "You do not have permission to create workspace tasks." };
    }
    const safeAssignee = scope.data === "personal" ? null : await ensureValidAssignee(supabase, workspaceId.data, assigneeId.data);
    if (assigneeId.data && !safeAssignee) return { error: "Choose a valid assignee." };
    const safeParent = await ensureTaskParent(supabase, workspaceId.data, parentTaskId.data);
    if (parentTaskId.data && !safeParent) return { error: "Choose a valid parent task." };
    const recurrenceRule = parseRecurrenceRule(formData);
    const { data, error } = await supabase.from("tasks").insert({
      workspace_id: workspaceId.data,
      parent_task_id: safeParent,
      title: sanitizeTaskTitle(title.data),
      description_md: sanitizeTaskDescription(descriptionMd.data),
      status: status.data,
      priority: priority.data,
      scope: scope.data,
      assignee_id: safeAssignee,
      start_date: startDate,
      due_date: dueDate,
      recurrence_rule: recurrenceRule,
      created_by: user.id,
      updated_by: user.id,
    }).select("id").single();
    if (error || !data?.id) return { error: error?.message ?? "The task could not be created." };

    const labels = parseTaskLabels(String(formData.get("labels") ?? ""));
    if (labels.length > 0) {
      await replaceTaskLabels(supabase, workspaceId.data, data.id, user.id, labels);
    }

  await recordTaskAudit(supabase, workspaceId.data, "task.created", data.id, {
      title: sanitizeTaskTitle(title.data),
      scope: scope.data,
      priority: priority.data,
      assignee_id: safeAssignee,
      parent_task_id: safeParent,
    });
    revalidateTasks(data.id);
    redirect(`/tasks/${data.id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function saveTaskDraftAction(input: TaskDraftInput): Promise<TaskDraftResult> {
  const taskId = uuid.safeParse(input.taskId);
  const title = z.string().trim().min(1).max(TASK_TITLE_LIMIT).safeParse(input.title);
  const descriptionMd = z.string().max(TASK_DESCRIPTION_LIMIT).safeParse(input.descriptionMd);
  const status = taskStatusEnum.safeParse(input.status);
  const priority = taskPriorityEnum.safeParse(input.priority);
  const scope = taskScopeEnum.safeParse(input.scope);
  const assigneeId = input.assigneeId ? uuid.safeParse(input.assigneeId) : { success: true as const, data: null };
  const parentTaskId = input.parentTaskId ? uuid.safeParse(input.parentTaskId) : { success: true as const, data: null };
  if (!taskId.success || !title.success || !descriptionMd.success || !status.success || !priority.success || !scope.success || !assigneeId.success || !parentTaskId.success) {
    return { ok: false, error: "Draft validation failed." };
  }

  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    if (input.revision !== task.revision) {
      return { ok: false, error: "This task changed while you were editing.", conflict: true, revision: task.revision };
    }
    const safeAssignee = scope.data === "personal" ? null : await ensureValidAssignee(supabase, task.workspace_id, assigneeId.data);
    if (assigneeId.data && !safeAssignee) return { ok: false, error: "Choose a valid assignee." };
    const safeParent = await ensureTaskParent(supabase, task.workspace_id, parentTaskId.data);
    if (parentTaskId.data && !safeParent) return { ok: false, error: "Choose a valid parent task." };
    const recurrenceRule = input.recurrenceRule ? normalizeTaskRecurrenceRule(input.recurrenceRule) : null;
    const nextTaskState: TaskRecord = {
      ...task,
      title: sanitizeTaskTitle(title.data),
      description_md: sanitizeTaskDescription(descriptionMd.data),
      status: status.data,
      priority: priority.data,
      scope: scope.data,
      assignee_id: safeAssignee,
      parent_task_id: safeParent,
      start_date: input.startDate,
      due_date: input.dueDate,
      recurrence_rule: recurrenceRule,
    };

    if (status.data === "completed" && task.status !== "completed") {
      const completionResult = await completeTaskByRecord(supabase, nextTaskState, user.id);
    await recordTaskAudit(supabase, task.workspace_id, "task.completed", task.id, { next_task_id: completionResult.nextTaskId });
      revalidateTasks(task.id);
      return { ok: true, savedAt: new Date().toISOString(), revision: task.revision + 1, nextTaskId: completionResult.nextTaskId ?? undefined };
    }

    const payload = {
      title: sanitizeTaskTitle(title.data),
      description_md: sanitizeTaskDescription(descriptionMd.data),
      status: status.data,
      priority: priority.data,
      scope: scope.data,
      assignee_id: safeAssignee,
      parent_task_id: safeParent,
      start_date: input.startDate,
      due_date: input.dueDate,
      recurrence_rule: recurrenceRule,
      completed_at: status.data === "completed" ? task.completed_at ?? new Date().toISOString() : null,
      completed_by: status.data === "completed" ? task.completed_by ?? user.id : null,
      updated_by: user.id,
      revision: task.revision + 1,
    };
    const { error } = await supabase.from("tasks").update(payload).eq("id", task.id).eq("revision", task.revision);
    if (error) return { ok: false, error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.updated", task.id, { status: status.data, priority: priority.data, scope: scope.data });
    revalidateTasks(task.id);
    return { ok: true, savedAt: new Date().toISOString(), revision: task.revision + 1 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Draft could not be saved." };
  }
}

export async function completeTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  if (!taskId.success) return { error: "Select a valid task." };
  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    const result = await completeTaskByRecord(supabase, task, user.id);
    await recordTaskAudit(supabase, task.workspace_id, "task.completed", task.id, { next_task_id: result.nextTaskId });
    revalidateTasks(task.id);
    return { message: result.nextTaskId ? "Task completed and the next occurrence was created." : "Task completed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function reopenTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  if (!taskId.success) return { error: "Select a valid task." };
  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    const { error } = await supabase.from("tasks").update({
      status: "todo",
      completed_at: null,
      completed_by: null,
      updated_by: user.id,
      revision: task.revision + 1,
    }).eq("id", task.id).eq("revision", task.revision);
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.reopened", task.id, {});
    revalidateTasks(task.id);
    return { message: "Task reopened." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveTaskLabelsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  const labels = parseTaskLabels(String(formData.get("labels") ?? ""));
  if (!taskId.success) return { error: "Select a valid task." };
  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    await replaceTaskLabels(supabase, task.workspace_id, task.id, user.id, labels);
    await recordTaskAudit(supabase, task.workspace_id, "task.labels.updated", task.id, { labels });
    revalidateTasks(task.id);
    return { message: "Task labels saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addTaskCommentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  const body = z.string().trim().min(1, "Write a comment.").max(TASK_COMMENT_LIMIT).safeParse(formData.get("body"));
  if (!taskId.success || !body.success) return { error: body.success ? "Select a valid task." : body.error.issues[0]?.message };
  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    const { error } = await supabase.from("task_comments").insert({ workspace_id: task.workspace_id, task_id: task.id, author_id: user.id, body: sanitizeTaskDescription(body.data) || body.data, deleted_at: null });
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.comment.created", task.id, {});
    revalidateTasks(task.id);
    return { message: "Comment added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addTaskLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  const targetType = z.enum(["project", "contact", "ticket", "event", "goal"]).safeParse(formData.get("targetType"));
  const targetId = uuid.safeParse(formData.get("targetId"));
  if (!taskId.success || !targetType.success || !targetId.success) return { error: "Choose a valid linked record." };
  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    const { error } = await supabase.from("task_links").insert({ workspace_id: task.workspace_id, task_id: task.id, target_type: targetType.data, target_id: targetId.data, created_by: user.id });
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.link.created", task.id, { target_type: targetType.data, target_id: targetId.data });
    revalidateTasks(task.id);
    return { message: "Link added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeTaskLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  const linkId = uuid.safeParse(formData.get("linkId"));
  if (!taskId.success || !linkId.success) return { error: "Choose a valid linked record." };
  try {
    const { supabase, task } = await loadEditableTask(taskId.data);
    const { error } = await supabase.from("task_links").delete().eq("workspace_id", task.workspace_id).eq("task_id", task.id).eq("id", linkId.data);
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.link.deleted", task.id, { link_id: linkId.data });
    revalidateTasks(task.id);
    return { message: "Link removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addTaskDependencyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  const dependsOnTaskId = uuid.safeParse(formData.get("dependsOnTaskId"));
  if (!taskId.success || !dependsOnTaskId.success) return { error: "Choose a valid dependency." };
  try {
    const { user, supabase, task } = await loadEditableTask(taskId.data);
    if (task.id === dependsOnTaskId.data) return { error: "A task cannot depend on itself." };
    const { data: target } = await supabase.from("tasks").select("id").eq("workspace_id", task.workspace_id).eq("id", dependsOnTaskId.data).is("deleted_at", null).maybeSingle();
    if (!target) return { error: "Choose a valid dependency." };
    const { error } = await supabase.from("task_dependencies").insert({ workspace_id: task.workspace_id, task_id: task.id, depends_on_task_id: dependsOnTaskId.data, created_by: user.id });
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.dependency.created", task.id, { depends_on_task_id: dependsOnTaskId.data });
    revalidateTasks(task.id);
    return { message: "Dependency added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeTaskDependencyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  const dependencyId = uuid.safeParse(formData.get("dependencyId"));
  if (!taskId.success || !dependencyId.success) return { error: "Choose a valid dependency." };
  try {
    const { supabase, task } = await loadEditableTask(taskId.data);
    const { error } = await supabase.from("task_dependencies").delete().eq("workspace_id", task.workspace_id).eq("task_id", task.id).eq("id", dependencyId.data);
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, task.workspace_id, "task.dependency.deleted", task.id, { dependency_id: dependencyId.data });
    revalidateTasks(task.id);
    return { message: "Dependency removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  if (!taskId.success) return { error: "Select a valid task." };
  try {
    const { user, supabase, task } = await loadManageableTask(taskId.data);
    const count = await softDeleteTaskTree(supabase, task.workspace_id, [task.id], user.id);
    await recordTaskAudit(supabase, task.workspace_id, "task.deleted", task.id, { deleted_count: count });
    revalidateTasks(task.id);
    return { message: "Task moved to trash." };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const taskId = uuid.safeParse(formData.get("taskId"));
  if (!taskId.success) return { error: "Select a valid task." };
  try {
    const { user, supabase, task } = await loadManageableTask(taskId.data);
    await restoreTaskTree(supabase, task.workspace_id, task.id, user.id);
    await recordTaskAudit(supabase, task.workspace_id, "task.restored", task.id, {});
    revalidateTasks(task.id);
    return { message: "Task restored." };
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkCompleteTasksAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const taskIds = formData.getAll("taskIds").map((value) => String(value)).filter(Boolean);
  if (!workspaceId.success || taskIds.length === 0) return { error: "Select at least one task." };
  try {
    const { user, supabase } = await ensureWorkspacePermission(workspaceId.data, "tasks.write");
    const { data: tasks } = await supabase.from("tasks").select("*").eq("workspace_id", workspaceId.data).in("id", taskIds).is("deleted_at", null).range(0, 99);
    let completedCount = 0;
    for (const task of (tasks ?? []) as TaskRecord[]) {
      const result = await completeTaskByRecord(supabase, task, user.id);
      if (result.completed) completedCount += 1;
    }
    await recordTaskAudit(supabase, workspaceId.data, "task.bulk_completed", null, { task_ids: taskIds, completed_count: completedCount });
    for (const taskId of taskIds) revalidateTasks(taskId);
    return { message: `${completedCount} task${completedCount === 1 ? "" : "s"} completed.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkReassignTasksAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const assigneeId = parseOptionalUuid(formData.get("assigneeId"));
  const taskIds = formData.getAll("taskIds").map((value) => String(value)).filter(Boolean);
  if (!workspaceId.success || !assigneeId.success || taskIds.length === 0 || !assigneeId.data) return { error: "Select tasks and a new assignee." };
  try {
    const { user, supabase } = await ensureWorkspacePermission(workspaceId.data, "tasks.manage");
    const safeAssignee = await ensureValidAssignee(supabase, workspaceId.data, assigneeId.data);
    if (!safeAssignee) return { error: "Choose a valid assignee." };
    const { error } = await supabase.from("tasks").update({ assignee_id: safeAssignee, updated_by: user.id }).eq("workspace_id", workspaceId.data).in("id", taskIds).is("deleted_at", null);
    if (error) return { error: error.message };
    await recordTaskAudit(supabase, workspaceId.data, "task.bulk_reassigned", null, { task_ids: taskIds, assignee_id: safeAssignee });
    taskIds.forEach((taskId) => revalidateTasks(taskId));
    return { message: "Tasks reassigned." };
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkDeleteTasksAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const taskIds = formData.getAll("taskIds").map((value) => String(value)).filter(Boolean);
  if (!workspaceId.success || taskIds.length === 0) return { error: "Select at least one task." };
  if (confirmation !== "DELETE") return { error: "Type DELETE to confirm bulk deletion." };
  try {
    const { user, supabase } = await ensureWorkspacePermission(workspaceId.data, "tasks.manage");
    const count = await softDeleteTaskTree(supabase, workspaceId.data, taskIds, user.id);
    await recordTaskAudit(supabase, workspaceId.data, "task.bulk_deleted", null, { task_ids: taskIds, deleted_count: count });
    taskIds.forEach((taskId) => revalidateTasks(taskId));
    return { message: `${count} task${count === 1 ? "" : "s"} moved to trash.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function refreshTaskWorkflowsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  if (!workspaceId.success) return { error: "Select a valid workspace." };
  try {
    const { user, supabase } = await ensureWorkspacePermission(workspaceId.data, "tasks.write");
    const { data: tasks } = await supabase.from("tasks").select("*").eq("workspace_id", workspaceId.data).is("deleted_at", null).eq("status", "completed").not("recurrence_rule", "is", null).order("completed_at", { ascending: false }).range(0, 199);
    let createdOccurrences = 0;
    for (const task of (tasks ?? []) as TaskRecord[]) {
      const nextTaskId = await cloneRecurringTask(supabase, task, user.id);
      if (nextTaskId) createdOccurrences += 1;
    }
    await refreshOverdueNotifications(supabase, workspaceId.data);
    await recordTaskAudit(supabase, workspaceId.data, "task.workflows.refreshed", null, { recurring_created: createdOccurrences });
    return { message: createdOccurrences > 0 ? `Created ${createdOccurrences} recurring task${createdOccurrences === 1 ? "" : "s"} and refreshed overdue notifications.` : "Overdue notifications refreshed." };
  } catch (error) {
    return actionError(error);
  }
}
