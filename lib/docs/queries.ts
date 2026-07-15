import { createClient } from "@/lib/supabase/server";
import type { DriveFile, DocumentComment, DocumentFolder, DocumentLink, DocumentRecord, DocumentTag, DocumentVersion } from "@/lib/types";

export interface DocumentBreadcrumb { id: string | null; name: string; }

export interface DocumentLibraryData {
  folders: DocumentFolder[];
  documents: DocumentRecord[];
  favoriteIds: string[];
  tagNamesByDocument: Record<string, string[]>;
  recentDocuments: DocumentRecord[];
  totalDocuments: number;
  breadcrumbs: DocumentBreadcrumb[];
  moveFolders: DocumentFolder[];
  tags: DocumentTag[];
}

export interface DocumentDetail {
  document: DocumentRecord;
  versions: DocumentVersion[];
  comments: DocumentComment[];
  tags: DocumentTag[];
  links: DocumentLink[];
  shares: Array<{ id: string; user_id: string; permission: "read" | "edit" }>;
  attachments: DriveFile[];
}

export async function getDocumentLibrary({ userId, workspaceId, folderId, search, page, pageSize = 20 }: { userId: string; workspaceId: string; folderId: string | null; search: string; page: number; pageSize?: number }): Promise<DocumentLibraryData> {
  const supabase = await createClient();
  const offset = Math.max(0, page - 1) * pageSize;
  const foldersPromise = supabase.from("document_folders").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).eq("parent_id", folderId).order("name").range(0, 99);
  let documentQuery = supabase.from("documents").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).order("updated_at", { ascending: false }).range(offset, offset + pageSize - 1);
  documentQuery = folderId ? documentQuery.eq("folder_id", folderId) : documentQuery.is("folder_id", null);
  if (search) documentQuery = documentQuery.ilike("title", `%${search.replace(/[%_]/g, "\\$&").slice(0, 80)}%`);
  const [foldersResult, documentsResult, favoritesResult, recentResult, tagsResult, breadcrumbs, moveFolders] = await Promise.all([
    foldersPromise,
    documentQuery,
    supabase.from("document_favorites").select("document_id").eq("workspace_id", workspaceId).eq("user_id", userId),
    supabase.from("recent_items").select("entity_id,last_opened_at").eq("workspace_id", workspaceId).eq("user_id", userId).eq("entity_type", "document").order("last_opened_at", { ascending: false }).range(0, 7),
    supabase.from("document_tags").select("*").eq("workspace_id", workspaceId).order("name").range(0, 99),
    getDocumentBreadcrumbs(workspaceId, folderId),
    getDocumentMoveFolders(workspaceId),
  ]);
  const documents = (documentsResult.data ?? []) as DocumentRecord[];
  const documentIds = documents.map((document) => document.id);
  const [tagLinksResult, recentDocumentsResult] = await Promise.all([
    documentIds.length ? supabase.from("document_tag_links").select("document_id,tag_id").in("document_id", documentIds) : Promise.resolve({ data: [] as Array<{ document_id: string; tag_id: string }> }),
    recentResult.data?.length ? supabase.from("documents").select("*").in("id", [...new Set(recentResult.data.map((row) => row.entity_id))]).is("deleted_at", null) : Promise.resolve({ data: [] as DocumentRecord[] }),
  ]);
  const tagById = new Map(((tagsResult.data ?? []) as DocumentTag[]).map((tag) => [tag.id, tag.name]));
  const tagNamesByDocument: Record<string, string[]> = {};
  for (const link of (tagLinksResult.data ?? []) as Array<{ document_id: string; tag_id: string }>) {
    (tagNamesByDocument[link.document_id] ??= []).push(tagById.get(link.tag_id) ?? "");
  }
  const recentOrder = new Map((recentResult.data ?? []).map((row, index) => [row.entity_id, index]));
  const recentDocuments = ((recentDocumentsResult.data ?? []) as DocumentRecord[]).sort((left, right) => (recentOrder.get(left.id) ?? 0) - (recentOrder.get(right.id) ?? 0));
  return {
    folders: (foldersResult.data ?? []) as DocumentFolder[],
    documents,
    favoriteIds: (favoritesResult.data ?? []).map((row) => row.document_id),
    tagNamesByDocument,
    recentDocuments,
    totalDocuments: documentsResult.count ?? 0,
    breadcrumbs,
    moveFolders: (moveFolders ?? []) as DocumentFolder[],
    tags: (tagsResult.data ?? []) as DocumentTag[],
  };
}

export async function getDocumentBreadcrumbs(workspaceId: string, folderId: string | null): Promise<DocumentBreadcrumb[]> {
  const breadcrumbs: DocumentBreadcrumb[] = [{ id: null, name: "All documents" }];
  if (!folderId) return breadcrumbs;
  const supabase = await createClient();
  const nested: DocumentBreadcrumb[] = [];
  let currentId: string | null = folderId;
  for (let index = 0; index < 20 && currentId; index += 1) {
    const result = await supabase.from("document_folders").select("id,name,parent_id").eq("workspace_id", workspaceId).eq("id", currentId).is("deleted_at", null).maybeSingle();
    const folder = result.data as { id: string; name: string; parent_id: string | null } | null;
    if (!folder) break;
    nested.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  return breadcrumbs.concat(nested);
}

export async function getDocumentMoveFolders(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("document_folders").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).order("name").range(0, 199);
  return data ?? [];
}

export async function getDocumentDetail(documentId: string): Promise<DocumentDetail | null> {
  const supabase = await createClient();
  const { data: document } = await supabase.from("documents").select("*").eq("id", documentId).maybeSingle();
  if (!document) return null;
  const [versionsResult, commentsResult, tagsResult, linksResult, sharesResult, attachmentLinksResult] = await Promise.all([
    supabase.from("document_versions").select("*").eq("document_id", documentId).order("version_number", { ascending: false }).range(0, 49),
    supabase.from("document_comments").select("*,author:profiles(id,full_name,avatar_url)").eq("document_id", documentId).order("created_at", { ascending: true }).range(0, 99),
    supabase.from("document_tag_links").select("tag:document_tags(*)").eq("document_id", documentId),
    supabase.from("document_links").select("*").eq("document_id", documentId).order("created_at", { ascending: false }).range(0, 49),
    supabase.from("document_shares").select("id,user_id,permission").eq("document_id", documentId),
    supabase.from("drive_attachments").select("file_id").eq("target_type", "docs").eq("target_id", documentId),
  ]);
  const attachmentIds = (attachmentLinksResult.data ?? []).map((row) => row.file_id);
  const attachments = attachmentIds.length ? ((await supabase.from("drive_files").select("*").in("id", attachmentIds).is("deleted_at", null)).data ?? []) as DriveFile[] : [];
  return {
    document: document as DocumentRecord,
    versions: (versionsResult.data ?? []) as DocumentVersion[],
    comments: (commentsResult.data ?? []) as DocumentComment[],
    tags: ((tagsResult.data ?? []) as unknown as Array<{ tag: DocumentTag | null }>).map((row) => row.tag).filter(Boolean) as DocumentTag[],
    links: (linksResult.data ?? []) as DocumentLink[],
    shares: (sharesResult.data ?? []) as Array<{ id: string; user_id: string; permission: "read" | "edit" }>,
    attachments,
  };
}

export async function getDocumentAttachableFiles(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("drive_files").select("id,name,size_bytes").eq("workspace_id", workspaceId).eq("upload_status", "ready").is("deleted_at", null).order("updated_at", { ascending: false }).range(0, 99);
  return data ?? [];
}

export async function getPublicDocument(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_document", { public_slug_input: publicSlug });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
