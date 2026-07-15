"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_LINK_TARGETS, normalizeDocumentTag, sanitizeDocumentTitle } from "@/lib/docs/constants";
import type { DocumentLinkTarget } from "@/lib/types";

const uuid = z.string().uuid();
const markdown = z.string().max(1000000);

async function editableDocument(documentId: string) {
  const supabase = await createClient();
  const { data: document } = await supabase.from("documents").select("*").eq("id", documentId).maybeSingle();
  if (!document) throw new Error("Document not found or no longer available.");
  const { data: canEdit, error } = await supabase.rpc("can_edit_document", { target_document_id: documentId });
  if (error || !canEdit) throw new Error("You do not have permission to change this document.");
  return { supabase, document };
}

async function audit(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, action: string, documentId: string, metadata: Record<string, unknown> = {}) {
  await supabase.rpc("record_audit_event", { target_workspace_id: workspaceId, event_action: action, event_entity_type: "document", event_entity_id: documentId, event_metadata: metadata });
}

export async function createDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const folderValue = String(formData.get("folderId") ?? "");
  const folderId = folderValue ? uuid.safeParse(folderValue) : { success: true as const, data: null };
  const title = z.string().trim().min(1, "Enter a document title.").max(180).safeParse(formData.get("title"));
  if (!workspaceId.success || !folderId.success || !title.success) return { error: title.success ? "Choose a valid folder." : title.error.issues[0]?.message };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_document_for_current_user", { p_workspace_id: workspaceId.data, p_folder_id: folderId.data, p_title: sanitizeDocumentTitle(title.data) });
    if (error) return { error: error.message };
    const document = Array.isArray(data) ? data[0] : data;
    if (!document?.id) return { error: "The document could not be created." };
    revalidatePath("/docs");
    redirect(`/docs/${document.id}/edit`);
  } catch (error) {
    return actionError(error);
  }
  return { error: "The document could not be created." };
}

export async function createDocumentFolderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const parentValue = String(formData.get("parentId") ?? "");
  const parentId = parentValue ? uuid.safeParse(parentValue) : { success: true as const, data: null };
  const name = z.string().trim().min(1, "Enter a folder name.").max(120).refine((value) => !/[\\/]/.test(value), "Folder names cannot contain slashes.").safeParse(formData.get("name"));
  if (!workspaceId.success || !parentId.success || !name.success) return { error: name.success ? "Choose a valid folder." : name.error.issues[0]?.message };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: canWrite } = await supabase.rpc("has_workspace_permission", { target_workspace_id: workspaceId.data, required_permission: "docs.write" });
    if (!canWrite) return { error: "You do not have permission to create folders." };
    const { error } = await supabase.from("document_folders").insert({ workspace_id: workspaceId.data, parent_id: parentId.data, name: name.data, created_by: user.id, updated_by: user.id });
    if (error) return { error: error.code === "23505" ? "A folder with that name already exists here." : error.message };
    revalidatePath("/docs");
    return { message: "Folder created." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveDocumentDraftAction(input: { documentId: string; title: string; contentMd: string }) {
  const documentId = uuid.safeParse(input.documentId);
  const title = z.string().trim().min(1).max(180).safeParse(input.title);
  const contentMd = markdown.safeParse(input.contentMd);
  if (!documentId.success || !title.success || !contentMd.success) return { ok: false as const, error: "Draft validation failed." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_document_draft", { p_document_id: documentId.data, p_title: sanitizeDocumentTitle(title.data), p_content_md: contentMd.data });
    if (error) return { ok: false as const, error: error.message };
    revalidatePath(`/docs/${documentId.data}`);
    revalidatePath(`/docs/${documentId.data}/edit`);
    return { ok: true as const, savedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Draft could not be saved." };
  }
}

export async function saveDocumentVersionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const title = z.string().trim().min(1).max(180).safeParse(formData.get("title"));
  const contentMd = markdown.safeParse(formData.get("contentMd"));
  const visibility = z.enum(["private", "workspace", "public"]).safeParse(formData.get("visibility"));
  const status = z.enum(["draft", "published"]).safeParse(formData.get("status"));
  if (!documentId.success || !title.success || !contentMd.success || !visibility.success || !status.success) return { error: "Check the document details before saving." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_document_version", { p_document_id: documentId.data, p_title: sanitizeDocumentTitle(title.data), p_content_md: contentMd.data, p_visibility: visibility.data, p_status: status.data });
    if (error) return { error: error.message };
    const document = Array.isArray(data) ? data[0] : data;
    revalidatePath("/docs");
    revalidatePath(`/docs/${documentId.data}`);
    revalidatePath(`/docs/${documentId.data}/edit`);
    const publicUrl = document?.public_slug ? `/docs/public/${document.public_slug}` : undefined;
    return { message: status.data === "published" && publicUrl ? `Document published. Public link: ${publicUrl}` : status.data === "published" ? "Document published." : "Version saved.", publicUrl };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreDocumentVersionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const versionId = uuid.safeParse(formData.get("versionId"));
  const documentId = uuid.safeParse(formData.get("documentId"));
  if (!versionId.success || !documentId.success) return { error: "Select a valid version." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("restore_document_version", { target_version_id: versionId.data });
    if (error) return { error: error.message };
    revalidatePath("/docs");
    revalidatePath(`/docs/${documentId.data}`);
    revalidatePath(`/docs/${documentId.data}/edit`);
    return { message: "Version restored as a new version." };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleDocumentFavoriteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = uuid.safeParse(formData.get("workspaceId"));
  const documentId = uuid.safeParse(formData.get("documentId"));
  const favorite = formData.get("favorite") === "true";
  if (!workspaceId.success || !documentId.success) return { error: "Select a valid document." };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: canRead } = await supabase.rpc("can_read_document", { target_document_id: documentId.data });
    if (!canRead) return { error: "You cannot favorite this document." };
    if (favorite) {
      const { error } = await supabase.from("document_favorites").upsert({ workspace_id: workspaceId.data, document_id: documentId.data, user_id: user.id }, { onConflict: "document_id,user_id" });
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("document_favorites").delete().eq("workspace_id", workspaceId.data).eq("document_id", documentId.data).eq("user_id", user.id);
      if (error) return { error: error.message };
    }
    revalidatePath("/docs");
    revalidatePath(`/docs/${documentId.data}`);
    return { message: favorite ? "Added to favorites." : "Removed from favorites." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  if (!documentId.success) return { error: "Select a valid document." };
  try {
    const user = await requireUser();
    const { supabase, document } = await editableDocument(documentId.data);
    const { error } = await supabase.from("documents").update({ deleted_at: new Date().toISOString(), updated_by: user.id }).eq("id", documentId.data).is("deleted_at", null);
    if (error) return { error: error.message };
    await audit(supabase, document.workspace_id, "document.deleted", documentId.data);
    revalidatePath("/docs");
    return { message: "Document moved to the recycle bin." };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  if (!documentId.success) return { error: "Select a valid document." };
  try {
    const user = await requireUser();
    const { supabase, document } = await editableDocument(documentId.data);
    const { error } = await supabase.from("documents").update({ deleted_at: null, updated_by: user.id }).eq("id", documentId.data);
    if (error) return { error: error.message };
    await audit(supabase, document.workspace_id, "document.restored", documentId.data);
    revalidatePath("/docs");
    return { message: "Document restored." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveDocumentTagsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const rawTags = String(formData.get("tags") ?? "");
  if (!documentId.success) return { error: "Select a valid document." };
  const tags = [...new Set(rawTags.split(",").map(normalizeDocumentTag).filter(Boolean))].slice(0, 12);
  try {
    const user = await requireUser();
    const { supabase, document } = await editableDocument(documentId.data);
    const { error: deleteError } = await supabase.from("document_tag_links").delete().eq("document_id", documentId.data);
    if (deleteError) return { error: deleteError.message };
    for (const tag of tags) {
      const { data: tagRow, error: tagError } = await supabase.from("document_tags").upsert({ workspace_id: document.workspace_id, name: tag, created_by: user.id }, { onConflict: "workspace_id,name" }).select("id").single();
      if (tagError || !tagRow) return { error: tagError?.message ?? "Tag could not be saved." };
      const { error: linkError } = await supabase.from("document_tag_links").insert({ workspace_id: document.workspace_id, document_id: documentId.data, tag_id: tagRow.id, created_by: user.id });
      if (linkError) return { error: linkError.message };
    }
    revalidatePath("/docs");
    revalidatePath(`/docs/${documentId.data}`);
    return { message: "Tags saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function shareDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const userId = uuid.safeParse(formData.get("userId"));
  const permission = z.enum(["read", "edit"]).safeParse(formData.get("permission"));
  if (!documentId.success || !userId.success || !permission.success) return { error: "Choose a member and permission." };
  try {
    const user = await requireUser();
    const { supabase, document } = await editableDocument(documentId.data);
    const { data: member } = await supabase.from("memberships").select("id").eq("workspace_id", document.workspace_id).eq("user_id", userId.data).eq("status", "active").maybeSingle();
    if (!member) return { error: "That person is not an active workspace member." };
    const { error } = await supabase.from("document_shares").upsert({ workspace_id: document.workspace_id, document_id: documentId.data, user_id: userId.data, permission: permission.data, created_by: user.id }, { onConflict: "document_id,user_id" });
    if (error) return { error: error.message };
    await audit(supabase, document.workspace_id, "document.shared", documentId.data, { user_id: userId.data, permission: permission.data });
    revalidatePath(`/docs/${documentId.data}`);
    revalidatePath(`/docs/${documentId.data}/edit`);
    return { message: "Document share saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeDocumentShareAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const userId = uuid.safeParse(formData.get("userId"));
  if (!documentId.success || !userId.success) return { error: "Choose a valid share." };
  try {
    const { supabase, document } = await editableDocument(documentId.data);
    const { error } = await supabase.from("document_shares").delete().eq("document_id", documentId.data).eq("user_id", userId.data);
    if (error) return { error: error.message };
    await audit(supabase, document.workspace_id, "document.share_removed", documentId.data, { user_id: userId.data });
    revalidatePath(`/docs/${documentId.data}`);
    return { message: "Document share removed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addDocumentCommentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const body = z.string().trim().min(1, "Write a comment.").max(4000).safeParse(formData.get("body"));
  const lineValue = String(formData.get("lineNumber") ?? "");
  const lineNumber = lineValue ? z.coerce.number().int().positive().safeParse(lineValue) : { success: true as const, data: null };
  const mentionedValue = String(formData.get("mentionedUserId") ?? "");
  const mentionedUserId = mentionedValue ? uuid.safeParse(mentionedValue) : { success: true as const, data: null };
  if (!documentId.success || !body.success || !lineNumber.success || !mentionedUserId.success) return { error: body.success ? "Check the comment details." : body.error.issues[0]?.message };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: document } = await supabase.from("documents").select("workspace_id").eq("id", documentId.data).maybeSingle();
    if (!document) return { error: "Document not found." };
    const { data: comment, error } = await supabase.from("document_comments").insert({ workspace_id: document.workspace_id, document_id: documentId.data, author_id: user.id, body: body.data, line_number: lineNumber.data }).select("id").single();
    if (error || !comment) return { error: error?.message ?? "Comment could not be added." };
    if (mentionedUserId.data) {
      const { data: member } = await supabase.from("memberships").select("id").eq("workspace_id", document.workspace_id).eq("user_id", mentionedUserId.data).eq("status", "active").maybeSingle();
      if (member) await supabase.from("document_mentions").insert({ workspace_id: document.workspace_id, document_id: documentId.data, comment_id: comment.id, mentioned_user_id: mentionedUserId.data, created_by: user.id });
    }
    await audit(supabase, document.workspace_id, "document.comment_added", documentId.data);
    revalidatePath(`/docs/${documentId.data}`);
    return { message: "Comment added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function resolveDocumentCommentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const commentId = uuid.safeParse(formData.get("commentId"));
  const documentId = uuid.safeParse(formData.get("documentId"));
  const resolved = formData.get("resolved") === "true";
  if (!commentId.success || !documentId.success) return { error: "Select a valid comment." };
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("document_comments").update({ resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? user.id : null }).eq("id", commentId.data).eq("document_id", documentId.data);
    if (error) return { error: error.message };
    revalidatePath(`/docs/${documentId.data}`);
    return { message: resolved ? "Comment resolved." : "Comment reopened." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addDocumentLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const targetId = uuid.safeParse(formData.get("targetId"));
  const targetType = z.enum(DOCUMENT_LINK_TARGETS.map((target) => target.value) as [DocumentLinkTarget, ...DocumentLinkTarget[]]).safeParse(formData.get("targetType"));
  if (!documentId.success || !targetId.success || !targetType.success) return { error: "Choose a valid linked record." };
  try {
    const user = await requireUser();
    const { supabase, document } = await editableDocument(documentId.data);
    const { error } = await supabase.from("document_links").upsert({ workspace_id: document.workspace_id, document_id: documentId.data, target_type: targetType.data, target_id: targetId.data, created_by: user.id }, { onConflict: "document_id,target_type,target_id" });
    if (error) return { error: error.message };
    await audit(supabase, document.workspace_id, "document.link_added", documentId.data, { target_type: targetType.data, target_id: targetId.data });
    revalidatePath(`/docs/${documentId.data}`);
    return { message: "Link added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeDocumentLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const documentId = uuid.safeParse(formData.get("documentId"));
  const linkId = uuid.safeParse(formData.get("linkId"));
  if (!documentId.success || !linkId.success) return { error: "Select a valid link." };
  try {
    const { supabase } = await editableDocument(documentId.data);
    const { error } = await supabase.from("document_links").delete().eq("id", linkId.data).eq("document_id", documentId.data);
    if (error) return { error: error.message };
    revalidatePath(`/docs/${documentId.data}`);
    return { message: "Link removed." };
  } catch (error) {
    return actionError(error);
  }
}
