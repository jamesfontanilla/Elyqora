import type { TaskScope, TaskStatus } from "@/lib/types";

export interface TaskAccessContext {
  workspaceId: string;
  taskWorkspaceId: string;
  taskScope: TaskScope;
  taskStatus: TaskStatus;
  membershipStatus: string;
  createdBy: string;
  assigneeId: string | null;
  userId: string;
  canReadTasks: boolean;
  canWriteTasks: boolean;
  canManageTasks: boolean;
  isDeleted?: boolean;
}

function isOwnedTask(context: Pick<TaskAccessContext, "createdBy" | "assigneeId" | "userId">) {
  return context.createdBy === context.userId || context.assigneeId === context.userId;
}

export function canReadTaskRecord(context: Pick<TaskAccessContext, "workspaceId" | "taskWorkspaceId" | "taskScope" | "membershipStatus" | "createdBy" | "assigneeId" | "userId" | "canReadTasks" | "canManageTasks" | "isDeleted">) {
  if (context.workspaceId !== context.taskWorkspaceId || context.membershipStatus !== "active") return false;
  if (context.taskScope === "personal") return context.createdBy === context.userId;
  if (context.isDeleted) return isOwnedTask(context) || context.canManageTasks;
  return context.canReadTasks || isOwnedTask(context) || context.canManageTasks;
}

export function canEditTaskRecord(context: Pick<TaskAccessContext, "workspaceId" | "taskWorkspaceId" | "taskScope" | "taskStatus" | "membershipStatus" | "createdBy" | "assigneeId" | "userId" | "canReadTasks" | "canWriteTasks" | "canManageTasks" | "isDeleted">) {
  if (!canReadTaskRecord(context)) return false;
  if (context.isDeleted || context.taskStatus === "completed" || context.taskStatus === "canceled") return false;
  if (context.taskScope === "personal") return context.createdBy === context.userId;
  return context.canWriteTasks || context.canManageTasks || isOwnedTask(context);
}

export function canManageTaskRecord(context: Pick<TaskAccessContext, "workspaceId" | "taskWorkspaceId" | "taskScope" | "membershipStatus" | "createdBy" | "assigneeId" | "userId" | "canManageTasks" | "isDeleted">) {
  if (context.workspaceId !== context.taskWorkspaceId || context.membershipStatus !== "active") return false;
  if (context.taskScope === "personal") return context.createdBy === context.userId;
  return context.canManageTasks;
}
