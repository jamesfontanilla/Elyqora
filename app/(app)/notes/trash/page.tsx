import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getNotesList } from "@/lib/notes/queries";
import { NotesLibrary } from "@/components/notes/library";

type SearchParams = Promise<{ search?: string; page?: string }>;

export default async function TrashNotesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const params = await searchParams;
  const search = (params.search ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [data, canWrite] = await Promise.all([
    getNotesList({ workspaceId: workspace.id, search, page, mode: "trash" }),
    hasPermission(workspace.id, "notes.write"),
  ]);

  return <NotesLibrary workspace={workspace} data={data} mode="trash" search={search} basePath="/notes/trash" canWrite={canWrite} />;
}
