"use client";

import { useActionState } from "react";
import { Link2, Paperclip, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { AttachmentPicker } from "@/components/drive/attachment-picker";
import { detachDriveFileAction } from "@/lib/actions/drive";
import { CreateTaskForm, TaskCommentForm, TaskCompleteForm, TaskDeleteForm, TaskDependencyForm, TaskLabelsForm, TaskLinkForm, TaskRemoveDependencyForm, TaskRemoveLinkForm, TaskRestoreForm } from "@/components/tasks/forms";
import { formatTaskDate, formatTaskDueDate, getTaskPriorityClass, getTaskStatusClass } from "@/lib/tasks/constants";
import { getInitials } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/types";
import type { DriveFile, TaskAttachment, TaskComment, TaskDependency, TaskLink, TaskRecord } from "@/lib/types";

type Member = { user_id: string; profile?: { full_name?: string | null; avatar_url?: string | null } | null };
type AvailableTask = Pick<TaskRecord, "id" | "title" | "status" | "priority" | "due_date">;

export function TaskSidebar({
  workspaceId,
  task,
  labels,
  dependencies,
  subtasks,
  links,
  attachments,
  attachableFiles,
  comments,
  members,
  availableTasks,
  canEdit,
  canManage,
}: {
  workspaceId: string;
  task: TaskRecord;
  labels: Array<{ id: string; label: string }>;
  dependencies: TaskDependency[];
  subtasks: TaskRecord[];
  links: TaskLink[];
  attachments: Array<TaskAttachment & { file?: Pick<DriveFile, "id" | "name" | "mime_type" | "size_bytes" | "upload_status"> | null }>;
  attachableFiles: Array<Pick<DriveFile, "id" | "name" | "size_bytes">>;
  comments: Array<TaskComment & { author?: { id: string; full_name: string; avatar_url: string | null } | null }>;
  members: Member[];
  availableTasks: AvailableTask[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const memberLookup = new Map(members.map((member) => [member.user_id, member]));
  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader>
          <p className="eyebrow">Task details</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getTaskStatusClass(task.status)}`}>{task.status.replaceAll("_", " ")}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getTaskPriorityClass(task.priority)}`}>{task.priority}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Scope" value={task.scope} />
          <Row label="Assignee" value={memberLookup.get(task.assignee_id ?? "")?.profile?.full_name ?? "Unassigned"} />
          <Row label="Start" value={formatTaskDate(task.start_date, "No start date")} />
          <Row label="Due" value={formatTaskDueDate(task.due_date)} />
          <Row label="Revision" value={String(task.revision)} />
          <div className="flex flex-wrap gap-2 pt-1">
            {!task.deleted_at && canEdit && task.status !== "completed" && <TaskCompleteForm taskId={task.id}><Sparkles size={15} className="mr-1.5" />Complete</TaskCompleteForm>}
            {task.deleted_at && <TaskRestoreForm taskId={task.id} />}
            {!task.deleted_at && canManage && <TaskDeleteForm taskId={task.id} />}
          </div>
        </CardContent>
      </Card>

      {canEdit && <TaskLabelsForm taskId={task.id} labels={labels.map((item) => item.label).join(", ")} />}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-moss" />
            <h2 className="font-display text-xl font-semibold text-ink">Subtasks</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subtasks.length === 0 ? (
            <p className="text-sm text-[#667878]">No subtasks yet.</p>
          ) : (
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-ink">{subtask.title}</div>
                      <p className="text-xs text-[#8a9992]">{subtask.status}</p>
                    </div>
                    <a href={`/tasks/${subtask.id}`} className="text-xs font-semibold text-moss hover:underline">Open</a>
                  </div>
                </div>
              ))}
            </div>
          )}
          {canEdit && <CreateTaskForm workspaceId={workspaceId} members={members} parentTaskId={task.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-moss" />
            <h2 className="font-display text-xl font-semibold text-ink">Dependencies</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {dependencies.length === 0 ? (
              <p className="text-sm text-[#667878]">No dependencies yet.</p>
            ) : (
              dependencies.map((dependency) => (
                <div key={dependency.id} className="flex items-start justify-between gap-2 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{dependency.blocking_task?.title ?? "Blocking task"}</div>
                    <p className="text-xs text-[#8a9992]">{dependency.blocking_task?.status ?? "unknown"}</p>
                  </div>
                  {canEdit && <TaskRemoveDependencyForm taskId={task.id} dependencyId={dependency.id} />}
                </div>
              ))
            )}
          </div>
          {canEdit && <TaskDependencyForm taskId={task.id} tasks={availableTasks} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-moss" />
            <h2 className="font-display text-xl font-semibold text-ink">Linked records</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {links.length === 0 ? (
              <p className="text-sm text-[#667878]">No linked records yet.</p>
            ) : (
              links.map((link) => (
                <div key={link.id} className="flex items-start justify-between gap-2 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{link.target_type}</div>
                    <p className="text-xs text-[#8a9992]">{link.target_id}</p>
                  </div>
                  {canEdit && <TaskRemoveLinkForm taskId={task.id} linkId={link.id} />}
                </div>
              ))
            )}
          </div>
          {canEdit && <TaskLinkForm taskId={task.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-moss" />
            <h2 className="font-display text-xl font-semibold text-ink">Attachments</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AttachmentPicker workspaceId={workspaceId} targetType="tasks" targetId={task.id} files={attachableFiles.map((file) => ({ ...file, sizeBytes: file.size_bytes }))} attachedFileIds={attachments.map((attachment) => attachment.file_id)} />
          <div className="space-y-2">
            {attachments.length === 0 ? (
              <p className="text-sm text-[#667878]">No attached files yet.</p>
            ) : (
              attachments.map((attachment) => <TaskAttachmentItem key={attachment.id} workspaceId={workspaceId} taskId={task.id} file={attachment.file ?? null} fileId={attachment.file_id} />)
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-moss" />
            <h2 className="font-display text-xl font-semibold text-ink">Comments</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-[#667878]">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-mint text-xs text-moss">{getInitials(comment.author?.full_name)}</span>
                    <span>{comment.author?.full_name || "Team member"}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#667878]">{comment.body}</p>
                </div>
              ))}
            </div>
          )}
          {canEdit && <TaskCommentForm taskId={task.id} />}
        </CardContent>
      </Card>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[#667878]">{label}</span><span className="max-w-[170px] truncate font-semibold text-ink">{value}</span></div>;
}

function TaskAttachmentItem({ workspaceId, taskId, file, fileId }: { workspaceId: string; taskId: string; file: Pick<DriveFile, "id" | "name" | "mime_type" | "size_bytes" | "upload_status"> | null; fileId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(detachDriveFileAction, {});
  return (
    <div className="flex items-start justify-between gap-2 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
      <div>
        <div className="text-sm font-semibold text-ink">{file?.name ?? "Attached file"}</div>
        <p className="text-xs text-[#8a9992]">{file?.mime_type ?? fileId}</p>
      </div>
      <form action={action}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="targetType" value="tasks" />
        <input type="hidden" name="targetId" value={taskId} />
        <input type="hidden" name="fileId" value={fileId} />
        <FormMessage error={state.error} message={state.message} />
        <Button type="submit" variant="ghost" className="min-h-8 px-2 text-coral">Remove</Button>
      </form>
    </div>
  );
}
