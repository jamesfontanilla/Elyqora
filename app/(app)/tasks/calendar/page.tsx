import { getCurrentUser } from "@/lib/auth/guards";
import { getTasksListPageData } from "@/lib/tasks/page-data";
import { sanitizeTaskLabel } from "@/lib/tasks/constants";
import { TasksLibrary } from "@/components/tasks/library";

type SearchParams = Promise<{ search?: string; page?: string; label?: string }>;

export default async function TasksCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const search = (params.search ?? "").trim().slice(0, 80);
  const label = params.label ? sanitizeTaskLabel(params.label) : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageData = await getTasksListPageData({ userId: user.id, mode: "calendar", search, page, label });
  if (!pageData) return null;
  return <TasksLibrary workspace={pageData.workspace} data={pageData.data} mode="calendar" search={search} basePath="/tasks/calendar" label={label} canWrite={pageData.canWrite} canManage={pageData.canManage} members={pageData.members} />;
}
