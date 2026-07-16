import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace, getWorkspaceMembers } from "@/lib/workspaces/current";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreateTaskForm } from "@/components/tasks/forms";

type SearchParams = Promise<{ parentTaskId?: string }>;

export default async function NewTaskPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const params = await searchParams;
  const parentTaskId = params.parentTaskId && /^[0-9a-f-]{36}$/i.test(params.parentTaskId) ? params.parentTaskId : null;
  const canWrite = await hasPermission(workspace.id, "tasks.write");
  const members = await getWorkspaceMembers(workspace.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">Workspace / Tasks</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Start a task.</h1>
        <p className="mt-3 text-sm leading-6 text-[#667878]">Create a task for {workspace.name}. Personal tasks stay private to you, while workspace tasks can be assigned and shared.</p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-ink">New task</h2>
          <p className="mt-1 text-sm text-[#667878]">Use Markdown in the description and add recurrence only when the work repeats.</p>
        </CardHeader>
        <CardContent>
          {canWrite ? <CreateTaskForm workspaceId={workspace.id} members={members} parentTaskId={parentTaskId} /> : <p className="rounded-xl bg-sand/60 p-4 text-sm text-[#667878]">You do not have permission to create workspace tasks in this workspace.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
