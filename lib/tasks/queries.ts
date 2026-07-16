import { createClient } from "@/lib/supabase/server";
import { getDriveAttachableFiles } from "@/lib/drive/queries";
import { TASK_PAGE_SIZE, sanitizeTaskLabel, isTaskOverdue } from "@/lib/tasks/constants";
import type { DriveFile, TaskAttachment, TaskComment, TaskDependency, TaskLabel, TaskLink, TaskPriority, TaskRecord, TaskScope, TaskStatus } from "@/lib/types";

export type TasksListMode = "all" | "board" | "calendar" | "mine" | "overdue" | "completed";

export interface TasksListData {
  tasks: TaskRecord[];
  totalTasks: number;
  page: number;
  totalPages: number;
  labels: Array<{ label: string; count: number }>;
  labelsByTask: Record<string, string[]>;
  recentTasks: TaskRecord[];
  myTasks: TaskRecord[];
  overdueTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  counts: {
    open: number;
    completed: number;
    overdue: number;
    mine: number;
    personal: number;
    workspace: number;
  };
}

export interface TaskDetailData {
  task: TaskRecord;
  labels: TaskLabel[];
  dependencies: TaskDependency[];
  subtasks: TaskRecord[];
  comments: Array<TaskComment & { author?: { id: string; full_name: string; avatar_url: string | null } | null }>;
  links: TaskLink[];
  attachments: Array<TaskAttachment & { file?: Pick<DriveFile, "id" | "name" | "mime_type" | "size_bytes" | "upload_status"> | null }>;
  attachableFiles: Array<Pick<DriveFile, "id" | "name" | "size_bytes">>;
  blockingTasks: TaskRecord[];
}

function buildActiveTaskQuery(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string) {
  return supabase.from("tasks").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]);
}

export async function getTasksList({
  workspaceId,
  userId,
  search = "",
  page = 1,
  mode = "all",
  label,
  status,
  priority,
  assigneeId,
  scope,
  pageSize = TASK_PAGE_SIZE,
}: {
  workspaceId: string;
  userId: string;
  search?: string;
  page?: number;
  mode?: TasksListMode;
  label?: string | null;
  status?: TaskStatus | null;
  priority?: TaskPriority | null;
  assigneeId?: string | null;
  scope?: TaskScope | null;
  pageSize?: number;
}): Promise<TasksListData> {
  const supabase = await createClient();
  const offset = Math.max(0, page - 1) * pageSize;
  const normalizedSearch = search.trim().slice(0, 80);
  const normalizedLabel = label ? sanitizeTaskLabel(label) : null;
  const today = new Date().toISOString().slice(0, 10);

  let labelTaskIds: string[] | null = null;
  if (normalizedLabel) {
    const { data: labelRows } = await supabase.from("task_labels").select("task_id").eq("workspace_id", workspaceId).eq("label", normalizedLabel).range(0, 399);
    labelTaskIds = [...new Set((labelRows ?? []).map((row) => row.task_id))];
    if (labelTaskIds.length === 0) {
      return {
        tasks: [],
        totalTasks: 0,
        page: 1,
        totalPages: 1,
        labels: [],
        labelsByTask: {},
        recentTasks: [],
        myTasks: [],
        overdueTasks: [],
        completedTasks: [],
        counts: { open: 0, completed: 0, overdue: 0, mine: 0, personal: 0, workspace: 0 },
      };
    }
  }

  let taskQuery = buildActiveTaskQuery(supabase, workspaceId);
  if (mode === "completed") {
    taskQuery = supabase.from("tasks").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).eq("status", "completed");
  } else if (mode === "overdue") {
    taskQuery = supabase.from("tasks").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).not("due_date", "is", null).lt("due_date", today);
  } else if (mode === "calendar") {
    taskQuery = supabase.from("tasks").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).not("due_date", "is", null).gte("due_date", today);
  } else if (mode === "mine") {
    taskQuery = supabase.from("tasks").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
  } else if (mode === "board") {
    taskQuery = supabase.from("tasks").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null);
  }

  if (scope) taskQuery = taskQuery.eq("scope", scope);
  if (priority) taskQuery = taskQuery.eq("priority", priority);
  if (status) taskQuery = taskQuery.eq("status", status);
  if (assigneeId) taskQuery = taskQuery.eq("assignee_id", assigneeId);
  if (labelTaskIds) taskQuery = taskQuery.in("id", labelTaskIds);
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch.replace(/[%_,]/g, "\\$&")}%`;
    taskQuery = taskQuery.or(`title.ilike.${pattern},description_md.ilike.${pattern}`);
  }

  const orderedQuery = mode === "completed"
    ? taskQuery.order("completed_at", { ascending: false }).order("updated_at", { ascending: false })
    : mode === "overdue"
      ? taskQuery.order("due_date", { ascending: true }).order("updated_at", { ascending: false })
      : mode === "calendar"
        ? taskQuery.order("due_date", { ascending: true }).order("priority", { ascending: false })
        : taskQuery.order("due_date", { ascending: true }).order("priority", { ascending: false }).order("updated_at", { ascending: false });
  const tasksResult = await orderedQuery.range(offset, offset + pageSize - 1);
  const tasks = (tasksResult.data ?? []) as TaskRecord[];
  const taskIdsOnPage = tasks.map((task) => task.id);

  const [labelsByTaskResult, labelsResult, recentTasksResult, myTasksResult, overdueTasksResult, completedTasksResult, countsResult] = await Promise.all([
    taskIdsOnPage.length > 0
      ? supabase.from("task_labels").select("task_id,label").eq("workspace_id", workspaceId).in("task_id", taskIdsOnPage).range(0, 399)
      : Promise.resolve({ data: [] as Array<{ task_id: string; label: string }> }),
    supabase.from("task_labels").select("label").eq("workspace_id", workspaceId).range(0, 399),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).order("updated_at", { ascending: false }).range(0, 7),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).or(`assignee_id.eq.${userId},created_by.eq.${userId}`).order("updated_at", { ascending: false }).range(0, 7),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).not("due_date", "is", null).lt("due_date", today).order("due_date", { ascending: true }).range(0, 7),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).eq("status", "completed").order("completed_at", { ascending: false }).range(0, 7),
    Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).eq("status", "completed"),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).not("due_date", "is", null).lt("due_date", today),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).in("status", ["todo", "in_progress", "blocked"]).or(`assignee_id.eq.${userId},created_by.eq.${userId}`),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).eq("scope", "personal"),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null).eq("scope", "workspace"),
    ]),
  ]);

  const labels = ((labelsResult.data ?? []) as Array<{ label: string }>).reduce<Record<string, number>>((map, row) => {
    if (!row.label) return map;
    map[row.label] = (map[row.label] ?? 0) + 1;
    return map;
  }, {});
  const labelsByTask = ((labelsByTaskResult.data ?? []) as Array<{ task_id: string; label: string }>).reduce<Record<string, string[]>>((map, row) => {
    (map[row.task_id] ??= []).push(row.label);
    return map;
  }, {});

  return {
    tasks,
    totalTasks: tasksResult.count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((tasksResult.count ?? 0) / pageSize)),
    labels: Object.entries(labels).sort(([left], [right]) => left.localeCompare(right)).map(([labelName, count]) => ({ label: labelName, count })),
    labelsByTask,
    recentTasks: (recentTasksResult.data ?? []) as TaskRecord[],
    myTasks: (myTasksResult.data ?? []) as TaskRecord[],
    overdueTasks: (overdueTasksResult.data ?? []) as TaskRecord[],
    completedTasks: (completedTasksResult.data ?? []) as TaskRecord[],
    counts: {
      open: countsResult[0].count ?? 0,
      completed: countsResult[1].count ?? 0,
      overdue: countsResult[2].count ?? 0,
      mine: countsResult[3].count ?? 0,
      personal: countsResult[4].count ?? 0,
      workspace: countsResult[5].count ?? 0,
    },
  };
}

export async function getTaskDetail(taskId: string, workspaceId: string): Promise<TaskDetailData | null> {
  const supabase = await createClient();
  const [taskResult, labelsResult, dependenciesResult, subtasksResult, commentsResult, linksResult, attachmentsResult, filesResult] = await Promise.all([
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).eq("id", taskId).maybeSingle(),
    supabase.from("task_labels").select("*").eq("workspace_id", workspaceId).eq("task_id", taskId).order("label", { ascending: true }).range(0, 49),
    supabase.from("task_dependencies").select("*").eq("workspace_id", workspaceId).eq("task_id", taskId).order("created_at", { ascending: false }).range(0, 49),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId).eq("parent_task_id", taskId).is("deleted_at", null).order("created_at", { ascending: true }).range(0, 49),
    supabase.from("task_comments").select("*,author:profiles(id,full_name,avatar_url)").eq("workspace_id", workspaceId).eq("task_id", taskId).is("deleted_at", null).order("created_at", { ascending: true }).range(0, 99),
    supabase.from("task_links").select("*").eq("workspace_id", workspaceId).eq("task_id", taskId).order("created_at", { ascending: false }).range(0, 49),
    supabase.from("task_attachments").select("*,file:drive_files(id,name,mime_type,size_bytes,upload_status)").eq("workspace_id", workspaceId).eq("task_id", taskId).order("created_at", { ascending: false }).range(0, 49),
    getDriveAttachableFiles(workspaceId),
  ]);

  const task = (taskResult.data as TaskRecord | null) ?? null;
  if (!task) return null;

  const dependencyIds = ((dependenciesResult.data ?? []) as Array<{ depends_on_task_id: string }>).map((row) => row.depends_on_task_id);
  const blockingTasks = dependencyIds.length > 0
    ? ((await supabase.from("tasks").select("id,title,status,priority,due_date,assignee_id").in("id", dependencyIds).is("deleted_at", null)).data ?? []) as TaskRecord[]
    : [];

  return {
    task,
    labels: (labelsResult.data ?? []) as TaskLabel[],
    dependencies: ((dependenciesResult.data ?? []) as TaskDependency[]).map((dependency) => ({
      ...dependency,
      blocking_task: blockingTasks.find((candidate) => candidate.id === dependency.depends_on_task_id) ?? null,
    })),
    subtasks: (subtasksResult.data ?? []) as TaskRecord[],
    comments: (commentsResult.data ?? []) as TaskDetailData["comments"],
    links: (linksResult.data ?? []) as TaskLink[],
    attachments: (attachmentsResult.data ?? []) as TaskDetailData["attachments"],
    attachableFiles: (filesResult ?? []) as TaskDetailData["attachableFiles"],
    blockingTasks,
  };
}

export function isTaskOverdueRecord(task: Pick<TaskRecord, "due_date" | "status" | "deleted_at">) {
  return isTaskOverdue(task);
}
