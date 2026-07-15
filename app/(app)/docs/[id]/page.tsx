import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit3, FileText, Link2, MessageCircle, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace, getWorkspaceMembers } from "@/lib/workspaces/current";
import { createClient } from "@/lib/supabase/server";
import { getDocumentAttachableFiles, getDocumentDetail } from "@/lib/docs/queries";
import { MarkdownPreview } from "@/components/docs/markdown-preview";
import { DocumentCommentsPanel, DocumentFavoriteForm, DocumentSettingsPanel, DocumentVersionHistory } from "@/components/docs/forms";
import { AttachmentPicker } from "@/components/drive/attachment-picker";

export default async function DocumentReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const { id } = await params;
  const detail = await getDocumentDetail(id);
  if (!detail || detail.document.workspace_id !== workspace.id) notFound();
  const supabase = await createClient();
  const [canEditResult, canManage, members, attachableFiles, favoriteResult] = await Promise.all([
    supabase.rpc("can_edit_document", { target_document_id: id }),
    hasPermission(workspace.id, "docs.manage"),
    getWorkspaceMembers(workspace.id),
    getDocumentAttachableFiles(workspace.id),
    supabase.from("document_favorites").select("id").eq("document_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  const canEdit = Boolean(canEditResult.data);
  return <div className="space-y-8"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-moss"><ArrowLeft size={16} />Documents</Link><div className="flex items-center gap-2"><DocumentFavoriteForm workspaceId={workspace.id} documentId={id} favorite={Boolean(favoriteResult.data)} />{canEdit && <Link href={`/docs/${id}/edit`}><Button><Edit3 size={15} className="mr-2" />Edit document</Button></Link>}</div></div><section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]"><article className="min-w-0"><div className="mb-6 flex flex-wrap items-center gap-2"><Badge className={detail.document.status === "published" ? "bg-mint text-moss" : "bg-sand text-[#667878]"}>{detail.document.status}</Badge><Badge className="bg-sand text-[#667878]">{detail.document.visibility}</Badge>{detail.tags.map((tag) => <span key={tag.id} className="text-xs text-[#8a9992]">#{tag.name}</span>)}</div><h1 className="font-display text-5xl font-semibold tracking-tight text-ink">{detail.document.title}</h1><p className="mt-3 text-sm text-[#8a9992]">Updated {new Date(detail.document.updated_at).toLocaleString()}</p><div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-10"><MarkdownPreview content={detail.document.content_md} /></div></article><aside className="space-y-4"><Card><CardHeader><div className="flex items-center gap-2"><MessageCircle size={17} className="text-moss" /><h2 className="font-display text-xl font-semibold text-ink">Comments</h2></div></CardHeader><CardContent><DocumentCommentsPanel documentId={id} comments={detail.comments} members={members as never} /></CardContent></Card><Card><CardHeader><div className="flex items-center gap-2"><FileText size={17} className="text-moss" /><h2 className="font-display text-xl font-semibold text-ink">Version history</h2></div></CardHeader><CardContent><DocumentVersionHistory documentId={id} versions={detail.versions} canEdit={canEdit} /></CardContent></Card><DocumentSettingsPanel document={detail.document} tags={detail.tags} shares={detail.shares} links={detail.links} members={members as never} canEdit={canEdit || canManage} /></aside></section><section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center gap-2"><Paperclip size={17} className="text-moss" /><h2 className="font-display text-xl font-semibold text-ink">Drive Lite attachments</h2></div></CardHeader><CardContent><AttachmentPicker workspaceId={workspace.id} targetType="docs" targetId={id} files={attachableFiles as never} attachedFileIds={detail.attachments.map((file) => file.id)} />{detail.attachments.length > 0 && <div className="mt-4 space-y-2">{detail.attachments.map((file) => <Link key={file.id} href={`/api/drive/download?fileId=${file.id}`} className="focus-ring flex items-center gap-2 text-sm font-semibold text-moss"><Paperclip size={14} />{file.name}</Link>)}</div>}</CardContent></Card><Card><CardHeader><div className="flex items-center gap-2"><Link2 size={17} className="text-moss" /><h2 className="font-display text-xl font-semibold text-ink">Linked context</h2></div></CardHeader><CardContent><p className="text-sm leading-6 text-[#667878]">This document can connect to projects, tasks, contacts, tickets, events, and learning courses from the linked records panel.</p></CardContent></Card></section></div>;
}
