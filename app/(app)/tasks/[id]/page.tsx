import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/guards";
import { getTaskDetailPageData } from "@/lib/tasks/page-data";
import { TaskEditor } from "@/components/tasks/editor";
import { TaskSidebar } from "@/components/tasks/sidebar";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const pageData = await getTaskDetailPageData(user.id, id);
  if (!pageData) notFound();

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="eyebrow">Workspace / Tasks</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href="/tasks" className="inline-flex items-center gap-2 text-sm font-semibold text-moss hover:underline"><ArrowLeft size={16} />Back to tasks</Link>
            {pageData.taskData.task.deleted_at && <Badge className="bg-[#fff0ef] text-coral">Trash</Badge>}
          </div>
          <h1 className="mt-3 min-w-0 font-display text-4xl font-semibold tracking-tight text-ink">{pageData.taskData.task.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667878]">
            {pageData.taskData.task.scope === "personal" ? "This task stays visible only to you." : "This workspace task can be assigned, discussed, and linked to related work."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8a9992]">
          <Sparkles size={14} className="text-moss" />
          Task editor and context
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <TaskEditor task={pageData.taskData.task} members={pageData.members} canEdit={pageData.canEdit} />
        <TaskSidebar
          workspaceId={pageData.workspace.id}
          task={pageData.taskData.task}
          labels={pageData.taskData.labels}
          dependencies={pageData.taskData.dependencies}
          subtasks={pageData.taskData.subtasks}
          links={pageData.taskData.links}
          attachments={pageData.taskData.attachments}
          attachableFiles={pageData.taskData.attachableFiles}
          comments={pageData.taskData.comments}
          members={pageData.members}
          availableTasks={pageData.availableTasks}
          canEdit={pageData.canEdit}
          canManage={pageData.canManage}
        />
      </div>
    </div>
  );
}
