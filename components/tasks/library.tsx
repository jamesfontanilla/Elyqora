import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckSquare, Clock3, Filter, FolderKanban, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TaskBulkActionToolbar, TaskRefreshForm } from "@/components/tasks/forms";
import { TrackedLink } from "@/components/hub/tracked-link";
import { formatRelativeDate } from "@/lib/utils";
import { formatTaskDueDate, getTaskExcerpt, getTaskPriorityClass, getTaskStatusClass, isTaskOverdue } from "@/lib/tasks/constants";
import type { TasksListData, TasksListMode } from "@/lib/tasks/queries";
import type { Workspace } from "@/lib/types";

type Member = { user_id: string; profile?: { full_name?: string | null; avatar_url?: string | null } | null };

export function TasksLibrary({
  workspace,
  data,
  mode,
  search,
  basePath,
  label,
  canWrite,
  canManage,
  members = [],
}: {
  workspace: Workspace;
  data: TasksListData;
  mode: TasksListMode;
  search: string;
  basePath: string;
  label?: string | null;
  canWrite: boolean;
  canManage: boolean;
  members?: Member[];
}) {
  const title = mode === "board"
    ? "Board view"
    : mode === "calendar"
      ? "Calendar view"
      : mode === "mine"
        ? "My tasks"
        : mode === "overdue"
          ? "Overdue tasks"
          : mode === "completed"
            ? "Completed tasks"
            : label
              ? `#${label}`
              : "All tasks";
  const description = mode === "board"
    ? "Group work by status and keep the next move visible."
    : mode === "calendar"
      ? "See what is due soon without needing a full calendar."
      : mode === "mine"
        ? "Your assigned and self-owned work, bounded and easy to scan."
        : mode === "overdue"
          ? "Tasks that need attention because the due date has passed."
          : mode === "completed"
            ? "Completed work stays searchable and recoverable."
            : label
              ? `Tasks tagged with ${label}.`
              : "A fast, reliable place for personal and workspace tasks.";
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (label) query.set("label", label);
  const queryString = query.toString();

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Workspace / Tasks</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667878]">{description} Tasks stay lightweight in {workspace.name} and never need a background worker to keep recurring work moving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hub"><Button variant="secondary">Back to Hub</Button></Link>
          {canWrite && <Link href="/tasks/new"><Button>New task</Button></Link>}
          {canManage && <TaskRefreshForm workspaceId={workspace.id} />}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<CheckSquare size={18} />} label="Open tasks" value={String(data.counts.open)} detail="Tasks still in motion" />
        <StatCard icon={<Sparkles size={18} />} label="Completed" value={String(data.counts.completed)} detail="Finished work" />
        <StatCard icon={<Clock3 size={18} />} label="Overdue" value={String(data.counts.overdue)} detail="Needs attention soon" />
        <StatCard icon={<FolderKanban size={18} />} label="My tasks" value={String(data.counts.mine)} detail="Assigned or owned by you" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.86fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#667878]">
                  {TASK_NAV.map((item) => <Link key={item.href} href={item.href} className={`rounded-full px-3 py-1.5 font-semibold ${basePath === item.href || (item.href === "/tasks" && basePath === "/tasks") || (item.href !== "/tasks" && basePath.startsWith(item.href)) ? "bg-mint text-moss" : "bg-sand text-[#667878]"}`}>{item.label}</Link>)}
                </div>
                <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{title}</h2>
              </div>
              <form method="get" className="flex flex-wrap gap-2">
                {label && <input type="hidden" name="label" value={label} />}
                <Input name="search" defaultValue={search} placeholder="Search tasks" aria-label="Search tasks" />
                <Button type="submit" variant="secondary" aria-label="Search"><Search size={16} /></Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {mode === "all" && data.recentTasks.length > 0 && !search && !label && (
              <div className="rounded-2xl border border-[var(--line)] bg-sand/30 p-4">
                <p className="eyebrow">Recently updated</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recentTasks.map((task) => <TaskTrailCard key={task.id} workspaceId={workspace.id} task={task} />)}
                </div>
              </div>
            )}

            {mode === "all" && data.myTasks.length > 0 && !search && !label && (
              <div className="rounded-2xl border border-[var(--line)] bg-sand/30 p-4">
                <p className="eyebrow">Your tasks</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.myTasks.map((task) => <TaskTrailCard key={task.id} workspaceId={workspace.id} task={task} />)}
                </div>
              </div>
            )}

            {mode === "board" ? (
              <TaskBoardView workspaceId={workspace.id} tasks={data.tasks} labelsByTask={data.labelsByTask} members={members} />
            ) : mode === "calendar" ? (
              <TaskCalendarView workspaceId={workspace.id} tasks={data.tasks} labelsByTask={data.labelsByTask} members={members} />
            ) : (
              <>
                {canManage && (mode === "all" || mode === "mine") && (
                  <TaskBulkSection workspaceId={workspace.id} members={members} tasks={data.tasks} />
                )}
                {data.tasks.length === 0 ? (
                  <div className="rounded-2xl bg-sand/60 p-8 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-moss"><CheckSquare size={20} /></div>
                    <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{emptyTitle(mode, label)}</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667878]">{emptyBody(mode, label)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.tasks.map((task) => <TaskRow key={task.id} workspaceId={workspace.id} task={task} labels={data.labelsByTask[task.id] ?? []} bulkEnabled={canManage && (mode === "all" || mode === "mine")} members={members} />)}
                  </div>
                )}
              </>
            )}

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm">
                <span className="text-[#667878]">Page {data.page} of {data.totalPages}</span>
                <div className="flex gap-2">
                  {data.page > 1 && <Link href={`/tasks?${withPage(queryString, data.page - 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Previous</Link>}
                  {data.page < data.totalPages && <Link href={`/tasks?${withPage(queryString, data.page + 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Next</Link>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Filter chips</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Browse labels</h2>
                </div>
                <Filter size={18} className="text-moss" />
              </div>
            </CardHeader>
            <CardContent>
              {data.labels.length === 0 ? <p className="text-sm text-[#667878]">No labels yet.</p> : <div className="flex flex-wrap gap-2">{data.labels.slice(0, 14).map((item) => <Link key={item.label} href={`/tasks?${withLabel(queryString, item.label)}`} className="rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-[#667878] hover:bg-mint hover:text-moss">#{item.label} · {item.count}</Link>)}</div>}
            </CardContent>
          </Card>

          {mode === "all" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Quick summary</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-ink">What&apos;s next</h2>
                  </div>
                  <CalendarDays size={18} className="text-moss" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#667878]">
                <SummaryRow label="Personal tasks" value={String(data.counts.personal)} />
                <SummaryRow label="Workspace tasks" value={String(data.counts.workspace)} />
                <SummaryRow label="Open" value={String(data.counts.open)} />
                <SummaryRow label="Overdue" value={String(data.counts.overdue)} />
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

function TaskBulkSection({ workspaceId, members, tasks }: { workspaceId: string; members: Member[]; tasks: TasksListData["tasks"] }) {
  return (
    <form className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <TaskBulkActionToolbar members={members} taskCount={tasks.length} />
      <div className="grid gap-3">
        {tasks.map((task) => (
          <label key={task.id} className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
            <input type="checkbox" name="taskIds" value={task.id} className="mt-1 h-4 w-4 rounded border-[var(--line)] text-moss" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{task.title}</span>
              <span className="block text-xs text-[#8a9992]">{task.status} · {task.priority} · {task.scope}</span>
            </span>
          </label>
        ))}
      </div>
    </form>
  );
}

function TaskRow({ workspaceId, task, labels, bulkEnabled, members = [] }: { workspaceId: string; task: TasksListData["tasks"][number]; labels: string[]; bulkEnabled: boolean; members?: Member[] }) {
  const assigneeName = members.find((member) => member.user_id === task.assignee_id)?.profile?.full_name;
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:flex-row sm:items-start ${isTaskOverdue(task) ? "ring-1 ring-coral/20" : ""}`}>
      {bulkEnabled && <input type="checkbox" name="taskIds" value={task.id} className="mt-1 h-4 w-4 rounded border-[var(--line)] text-moss" />}
      <div className="min-w-0 flex-1">
        <TrackedLink href={`/tasks/${task.id}`} workspaceId={workspaceId} entityId={task.id} entityType="task" icon="✓" label={task.title} className="focus-ring block truncate text-lg font-semibold text-ink hover:text-moss">
          {task.title}
        </TrackedLink>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667878]">{getTaskExcerpt(task.description_md) || "Empty task"}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={getTaskStatusClass(task.status)}>{task.status.replaceAll("_", " ")}</Badge>
          <Badge className={getTaskPriorityClass(task.priority)}>{task.priority}</Badge>
          <Badge className="bg-sand text-[#667878]">{task.scope}</Badge>
          {assigneeName && <Badge className="bg-white text-moss">{assigneeName}</Badge>}
          {task.due_date && <Badge className={isTaskOverdue(task) ? "bg-[#fff4ec] text-coral" : "bg-sand text-[#667878]"}>{formatTaskDueDate(task.due_date)}</Badge>}
          {labels.slice(0, 4).map((label) => <span key={label} className="text-xs text-[#8a9992]">#{label}</span>)}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-[#8a9992]">
        <span>{task.updated_at ? `Updated ${formatRelativeDate(task.updated_at)}` : ""}</span>
        <ArrowUpRight size={15} />
      </div>
    </div>
  );
}

function TaskTrailCard({ workspaceId, task }: { workspaceId: string; task: TasksListData["tasks"][number] }) {
  return (
    <TrackedLink href={`/tasks/${task.id}`} workspaceId={workspaceId} entityId={task.id} entityType="task" icon="✓" label={task.title} className="focus-ring flex min-w-0 items-center gap-3 rounded-xl bg-white p-3">
      <CheckSquare size={15} className="shrink-0 text-moss" />
      <span className="truncate text-sm font-semibold text-ink">{task.title}</span>
    </TrackedLink>
  );
}

function TaskBoardView({ workspaceId, tasks, labelsByTask, members }: { workspaceId: string; tasks: TasksListData["tasks"]; labelsByTask: TasksListData["labelsByTask"]; members: Member[] }) {
  const columns = [
    { key: "todo", label: "To do" },
    { key: "in_progress", label: "In progress" },
    { key: "blocked", label: "Blocked" },
    { key: "completed", label: "Completed" },
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {columns.map((column) => {
        const items = tasks.filter((task) => task.status === column.key);
        return (
          <div key={column.key} className="rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-ink">{column.label}</h3>
              <Badge className="bg-white text-moss">{items.length}</Badge>
            </div>
            <div className="space-y-3">
              {items.length === 0 ? <div className="rounded-xl bg-white p-3 text-sm text-[#667878]">Nothing here.</div> : items.map((task) => <TaskRow key={task.id} workspaceId={workspaceId} task={task} labels={labelsByTask[task.id] ?? []} bulkEnabled={false} members={members} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCalendarView({ workspaceId, tasks, labelsByTask, members }: { workspaceId: string; tasks: TasksListData["tasks"]; labelsByTask: TasksListData["labelsByTask"]; members: Member[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = datePlusDays(1);
  const weekEnd = datePlusDays(7);
  const groups = [
    { label: "Today", test: (task: TasksListData["tasks"][number]) => task.due_date === today },
    { label: "Tomorrow", test: (task: TasksListData["tasks"][number]) => task.due_date === tomorrow },
    { label: "This week", test: (task: TasksListData["tasks"][number]) => task.due_date ? task.due_date > tomorrow && task.due_date <= weekEnd : false },
    { label: "Later", test: (task: TasksListData["tasks"][number]) => task.due_date ? task.due_date > weekEnd : false },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => {
        const items = tasks.filter(group.test);
        return (
          <div key={group.label} className="rounded-2xl border border-[var(--line)] bg-sand/20 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-ink">{group.label}</h3>
              <Badge className="bg-white text-moss">{items.length}</Badge>
            </div>
            <div className="space-y-3">
              {items.length === 0 ? <div className="rounded-xl bg-white p-3 text-sm text-[#667878]">No tasks in this bucket.</div> : items.map((task) => <TaskRow key={task.id} workspaceId={workspaceId} task={task} labels={labelsByTask[task.id] ?? []} bulkEnabled={false} members={members} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-7 flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-moss">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a9992]">Summary</span>
        </div>
        <div className="text-sm text-[#667878]">{label}</div>
        <div className="mt-1 text-3xl font-semibold text-ink">{value}</div>
        <p className="mt-2 text-xs leading-5 text-[#8a9992]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span>{label}</span><span className="font-semibold text-ink">{value}</span></div>;
}

function withPage(queryString: string, page: number) {
  const params = new URLSearchParams(queryString);
  params.set("page", String(page));
  return params.toString();
}

function withLabel(queryString: string, label: string) {
  const params = new URLSearchParams(queryString);
  params.set("label", label);
  return params.toString();
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export const TASK_NAV = [
  { href: "/tasks", label: "All" },
  { href: "/tasks/board", label: "Board" },
  { href: "/tasks/calendar", label: "Calendar" },
  { href: "/tasks/mine", label: "Mine" },
  { href: "/tasks/overdue", label: "Overdue" },
  { href: "/tasks/completed", label: "Completed" },
];

export function emptyTitle(mode: TasksListMode, label?: string | null) {
  if (mode === "board") return "No tasks on the board";
  if (mode === "calendar") return "Nothing due yet";
  if (mode === "mine") return "No tasks for you yet";
  if (mode === "overdue") return "No overdue tasks";
  if (mode === "completed") return "No completed tasks";
  if (label) return `No tasks tagged #${label}`;
  return "No tasks yet";
}

export function emptyBody(mode: TasksListMode, label?: string | null) {
  if (mode === "board") return "Create a few tasks and move them through the flow of work.";
  if (mode === "calendar") return "Once due dates are added, this view becomes a handy planning lane.";
  if (mode === "mine") return "Your assigned and self-owned work will gather here as you start using Tasks.";
  if (mode === "overdue") return "Overdue tasks appear here when the due date passes.";
  if (mode === "completed") return "Completed tasks stay available for review and recurrence refreshes.";
  if (label) return `Add the #${label} label to another task and it will show up here.`;
  return "Create a task, assign it, or give it a due date to get the workspace moving.";
}
