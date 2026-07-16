"use client";

import React, { useActionState, type ReactNode } from "react";
import { Check, Link2, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/auth/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { TASK_LINK_TARGETS, TASK_PRIORITY_OPTIONS, TASK_RECURRING_FREQUENCIES, TASK_SCOPES, TASK_STATUS_OPTIONS } from "@/lib/tasks/constants";
import type { ActionState } from "@/lib/actions/types";
import {
  addTaskCommentAction,
  addTaskDependencyAction,
  addTaskLinkAction,
  bulkCompleteTasksAction,
  bulkDeleteTasksAction,
  bulkReassignTasksAction,
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  refreshTaskWorkflowsAction,
  removeTaskDependencyAction,
  removeTaskLinkAction,
  restoreTaskAction,
  saveTaskLabelsAction,
} from "@/lib/actions/tasks";
import type { TaskRecord } from "@/lib/types";

type Member = { user_id: string; profile?: { full_name?: string | null; avatar_url?: string | null } | null };
type AvailableTask = Pick<TaskRecord, "id" | "title" | "status" | "priority" | "due_date">;

export function CreateTaskForm({ workspaceId, members = [], parentTaskId }: { workspaceId: string; members?: Member[]; parentTaskId?: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(createTaskAction, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {parentTaskId && <input type="hidden" name="parentTaskId" value={parentTaskId} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="title" placeholder="Task title" aria-label="Task title" required />
        <Select name="scope" defaultValue="workspace" aria-label="Task scope">
          {TASK_SCOPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
      <Textarea name="descriptionMd" placeholder="Task description" aria-label="Task description" />
      <div className="grid gap-3 md:grid-cols-3">
        <Select name="status" defaultValue="todo" aria-label="Task status">
          {TASK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select name="priority" defaultValue="medium" aria-label="Task priority">
          {TASK_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select name="assigneeId" defaultValue="" aria-label="Assignee">
          <option value="">No assignee</option>
          {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input name="startDate" type="date" aria-label="Start date" />
        <Input name="dueDate" type="date" aria-label="Due date" />
        <Input name="labels" placeholder="Labels, comma separated" aria-label="Task labels" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Select name="recurrenceFrequency" defaultValue="" aria-label="Recurrence frequency">
          <option value="">No recurrence</option>
          {TASK_RECURRING_FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Input name="recurrenceInterval" type="number" min="1" max="3650" defaultValue="1" aria-label="Recurrence interval" />
        <Input name="recurrenceDayOfMonth" type="number" min="1" max="31" placeholder="Day of month" aria-label="Recurrence day of month" />
        <Input name="recurrenceEndDate" type="date" aria-label="Recurrence end date" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="1" className="h-4 w-4 accent-[#3b6b58]" />Mon</label>
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="2" className="h-4 w-4 accent-[#3b6b58]" />Tue</label>
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="3" className="h-4 w-4 accent-[#3b6b58]" />Wed</label>
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="4" className="h-4 w-4 accent-[#3b6b58]" />Thu</label>
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="5" className="h-4 w-4 accent-[#3b6b58]" />Fri</label>
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="6" className="h-4 w-4 accent-[#3b6b58]" />Sat</label>
        <label className="flex items-center gap-2 text-xs text-[#667878]"><input type="checkbox" name="recurrenceWeekdays" value="0" className="h-4 w-4 accent-[#3b6b58]" />Sun</label>
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton><Plus size={15} className="mr-1.5" />Create task</SubmitButton>
    </form>
  );
}

export function TaskCompleteForm({ taskId, children }: { taskId: string; children?: ReactNode }) {
  const [state, action] = useActionState<ActionState, FormData>(completeTaskAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel="Completing...">{children ?? <><Check size={15} className="mr-1.5" />Complete task</>}</SubmitButton>
    </form>
  );
}

export function TaskRestoreForm({ taskId }: { taskId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(restoreTaskAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel="Restoring..."><Undo2 size={15} className="mr-1.5" />Restore task</SubmitButton>
    </form>
  );
}

export function TaskLabelsForm({ taskId, labels }: { taskId: string; labels: string }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTaskLabelsAction, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <label className="space-y-2 text-xs font-semibold text-[#667878]">
        Labels
        <Input name="labels" defaultValue={labels} placeholder="launch, follow-up" aria-label="Task labels" />
      </label>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton><Plus size={15} className="mr-1.5" />Save labels</SubmitButton>
    </form>
  );
}

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addTaskCommentAction, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea name="body" placeholder="Add a comment" aria-label="Task comment" />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>Add comment</SubmitButton>
    </form>
  );
}

export function TaskLinkForm({ taskId }: { taskId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addTaskLinkAction, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Select name="targetType" defaultValue="project" aria-label="Link target type">
          {TASK_LINK_TARGETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Input name="targetId" placeholder="Linked record ID" aria-label="Linked record ID" />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton><Link2 size={15} className="mr-1.5" />Add link</SubmitButton>
    </form>
  );
}

export function TaskDependencyForm({ taskId, tasks }: { taskId: string; tasks: AvailableTask[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addTaskDependencyAction, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <Select name="dependsOnTaskId" defaultValue="" aria-label="Depends on task">
        <option value="">Choose a blocking task</option>
        {tasks.filter((task) => task.id !== taskId).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
      </Select>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton><Plus size={15} className="mr-1.5" />Add dependency</SubmitButton>
    </form>
  );
}

export function TaskRemoveDependencyForm({ taskId, dependencyId }: { taskId: string; dependencyId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(removeTaskDependencyAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="dependencyId" value={dependencyId} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton variant="ghost" pendingLabel="Removing...">Remove</SubmitButton>
    </form>
  );
}

export function TaskRemoveLinkForm({ taskId, linkId }: { taskId: string; linkId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(removeTaskLinkAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="linkId" value={linkId} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton variant="ghost" pendingLabel="Removing...">Remove</SubmitButton>
    </form>
  );
}

export function TaskRefreshForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(refreshTaskWorkflowsAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton variant="secondary" pendingLabel="Refreshing..."><RefreshCw size={15} className="mr-1.5" />Refresh recurrence</SubmitButton>
    </form>
  );
}

export function TaskDeleteForm({ taskId }: { taskId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteTaskAction, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-coral/20 bg-[#fff7f4] p-4">
      <input type="hidden" name="taskId" value={taskId} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton variant="danger" pendingLabel="Deleting..."><Trash2 size={15} className="mr-1.5" />Delete task</SubmitButton>
    </form>
  );
}

export function TaskBulkActionToolbar({ members = [], taskCount }: { members?: Member[]; taskCount: number }) {
  const [, completeAction] = useActionState<ActionState, FormData>(bulkCompleteTasksAction, {});
  const [, reassignAction] = useActionState<ActionState, FormData>(bulkReassignTasksAction, {});
  const [, deleteAction] = useActionState<ActionState, FormData>(bulkDeleteTasksAction, {});

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-sand/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Bulk actions</p>
          <p className="text-sm text-[#667878]">Select from the {taskCount} tasks below, then use one of the actions here.</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
        <Select name="assigneeId" defaultValue="" aria-label="Bulk reassignee">
          <option value="">Choose assignee</option>
          {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}
        </Select>
        <Input name="confirmation" placeholder="Type DELETE to remove" aria-label="Bulk delete confirmation" />
        <Button type="submit" formAction={completeAction} variant="secondary"><Check size={15} className="mr-1.5" />Complete selected</Button>
        <Button type="submit" formAction={reassignAction} variant="secondary">Reassign selected</Button>
        <Button type="submit" formAction={deleteAction} variant="danger"><Trash2 size={15} className="mr-1.5" />Delete selected</Button>
      </div>
    </div>
  );
}
