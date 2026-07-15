import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getNotesList } from "@/lib/notes/queries";
import { NotesLibrary } from "@/components/notes/library";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function NotesByLabelPage({ params, searchParams }: { params: Promise<{ label: string }>; searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const { label } = await params;
  const query = (await searchParams);
  const search = (query.search ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const normalizedLabel = label.trim().toLowerCase().slice(0, 40);
  const [data, canWrite] = await Promise.all([
    getNotesList({ workspaceId: workspace.id, search, page, mode: "label", label: normalizedLabel }),
    hasPermission(workspace.id, "notes.write"),
  ]);

  return <NotesLibrary workspace={workspace} data={data} mode="label" label={normalizedLabel} search={search} basePath={`/notes/labels/${encodeURIComponent(normalizedLabel)}`} canWrite={canWrite} />;
}
