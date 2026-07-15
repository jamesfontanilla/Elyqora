import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreateNoteForm } from "@/components/notes/forms";

export default async function NewNotePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const canWrite = await hasPermission(workspace.id, "notes.write");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">Workspace / Notes</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Create a note.</h1>
        <p className="mt-3 text-sm leading-6 text-[#667878]">Use this for fast capture. You can refine the structure later inside the note editor.</p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-ink">New note</h2>
          <p className="mt-1 text-sm text-[#667878]">Personal notes stay private; workspace notes respect the role and visibility you choose.</p>
        </CardHeader>
        <CardContent>{canWrite ? <CreateNoteForm workspaceId={workspace.id} /> : <p className="rounded-2xl bg-sand/60 p-4 text-sm text-[#667878]">You do not have permission to create notes in this workspace.</p>}</CardContent>
      </Card>
    </div>
  );
}
