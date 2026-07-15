import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCurrentWorkspace, getWorkspaceMembers } from "@/lib/workspaces/current";
import { createClient } from "@/lib/supabase/server";
import { getDocumentAttachableFiles, getDocumentDetail } from "@/lib/docs/queries";
import { DocumentEditor } from "@/components/docs/editor";
import { DocumentSettingsPanel, DocumentVersionHistory } from "@/components/docs/forms";
import { AttachmentPicker } from "@/components/drive/attachment-picker";

export default async function DocumentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const { id } = await params;
  const detail = await getDocumentDetail(id);
  if (!detail || detail.document.workspace_id !== workspace.id) notFound();
  const supabase = await createClient();
  const [{ data: canEdit }, members, attachableFiles] = await Promise.all([
    supabase.rpc("can_edit_document", { target_document_id: id }),
    getWorkspaceMembers(workspace.id),
    getDocumentAttachableFiles(workspace.id),
  ]);
  if (!canEdit) redirect(`/docs/${id}`);
  return <div className="space-y-6"><Link href={`/docs/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-moss"><ArrowLeft size={16} />Read document</Link><DocumentEditor document={detail.document} /><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><h2 className="font-display text-xl font-semibold text-ink">Version history</h2></CardHeader><CardContent><DocumentVersionHistory documentId={id} versions={detail.versions} canEdit /></CardContent></Card><DocumentSettingsPanel document={detail.document} tags={detail.tags} shares={detail.shares} links={detail.links} members={members as never} canEdit /></div><Card><CardHeader><div className="flex items-center gap-2"><Paperclip size={17} className="text-moss" /><h2 className="font-display text-xl font-semibold text-ink">Attach from Drive Lite</h2></div></CardHeader><CardContent><AttachmentPicker workspaceId={workspace.id} targetType="docs" targetId={id} files={attachableFiles as never} attachedFileIds={detail.attachments.map((file) => file.id)} /></CardContent></Card><p className="text-xs text-[#8a9992]"><FileText size={13} className="mr-1 inline" />Markdown is canonical. Autosave keeps drafts current; manual saves create versions.</p></div>;
}
