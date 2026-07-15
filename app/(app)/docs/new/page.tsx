import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreateDocumentForm } from "@/components/docs/forms";

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const params = await searchParams;
  const canWrite = await hasPermission(workspace.id, "docs.write");

  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="eyebrow">Workspace / Documents</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Start a document.</h1><p className="mt-3 text-sm leading-6 text-[#667878]">Create a safe Markdown draft for {workspace.name}. Nothing is created until you submit this form.</p></div><Card><CardHeader><h2 className="font-display text-2xl font-semibold text-ink">New document</h2><p className="mt-1 text-sm text-[#667878]">You can choose privacy and publish status after the first save.</p></CardHeader><CardContent>{canWrite ? <CreateDocumentForm workspaceId={workspace.id} folderId={params.folderId ?? null} /> : <p className="rounded-xl bg-sand/60 p-4 text-sm text-[#667878]">You do not have permission to create documents in this workspace.</p>}</CardContent></Card></div>;
}
