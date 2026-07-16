import { getMembership, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace, getWorkspaceMembers } from "@/lib/workspaces/current";
import { canEditTaskRecord, canManageTaskRecord } from "@/lib/tasks/access";
import { getTasksList, getTaskDetail, type TasksListMode } from "@/lib/tasks/queries";
import type { TaskRecord, Workspace } from "@/lib/types";
import type { TaskDetailData } from "@/lib/tasks/queries";

export async function getTasksListPageData({
  userId,
  mode,
  search,
  page,
  label,
}: {
  userId: string;
  mode: TasksListMode;
  search: string;
  page: number;
  label?: string | null;
}): Promise<{
  workspace: Workspace;
  data: Awaited<ReturnType<typeof getTasksList>>;
  canWrite: boolean;
  canManage: boolean;
  members: Awaited<ReturnType<typeof getWorkspaceMembers>>;
} | null> {
  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) return null;
  const [data, canWrite, canManage, members] = await Promise.all([
    getTasksList({ workspaceId: workspace.id, userId, mode, search, page, label }),
    hasPermission(workspace.id, "tasks.write"),
    hasPermission(workspace.id, "tasks.manage"),
    getWorkspaceMembers(workspace.id),
  ]);
  return { workspace, data, canWrite, canManage, members };
}

export async function getTaskDetailPageData(userId: string, taskId: string): Promise<{
  workspace: Workspace;
  taskData: TaskDetailData;
  members: Awaited<ReturnType<typeof getWorkspaceMembers>>;
  availableTasks: TaskRecord[];
  canEdit: boolean;
  canManage: boolean;
} | null> {
  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) return null;
  const [taskData, membership, canReadTasks, canWriteTasks, canManageTasks, members, availableTasksResult] = await Promise.all([
    getTaskDetail(taskId, workspace.id),
    getMembership(workspace.id, userId),
    hasPermission(workspace.id, "tasks.read"),
    hasPermission(workspace.id, "tasks.write"),
    hasPermission(workspace.id, "tasks.manage"),
    getWorkspaceMembers(workspace.id),
    getTasksList({ workspaceId: workspace.id, userId, mode: "all", pageSize: 200 }),
  ]);
  if (!taskData) return null;
  const access = {
    workspaceId: workspace.id,
    taskWorkspaceId: taskData.task.workspace_id,
    taskScope: taskData.task.scope,
    taskStatus: taskData.task.status,
    membershipStatus: membership?.status ?? "removed",
    createdBy: taskData.task.created_by,
    assigneeId: taskData.task.assignee_id,
    userId,
    canReadTasks,
    canWriteTasks,
    canManageTasks,
    isDeleted: Boolean(taskData.task.deleted_at),
  } as const;
  const canEdit = canEditTaskRecord(access);
  const canManage = canManageTaskRecord(access);
  return {
    workspace,
    taskData,
    members,
    availableTasks: availableTasksResult.tasks,
    canEdit,
    canManage,
  };
}
