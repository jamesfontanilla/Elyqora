"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/auth/submit-button";
import { addDocumentCommentAction, addDocumentLinkAction, createDocumentAction, createDocumentFolderAction, deleteDocumentAction, removeDocumentLinkAction, removeDocumentShareAction, resolveDocumentCommentAction, restoreDocumentAction, restoreDocumentVersionAction, saveDocumentTagsAction, shareDocumentAction, toggleDocumentFavoriteAction } from "@/lib/actions/docs";
import { DOCUMENT_LINK_TARGETS } from "@/lib/docs/constants";
import type { ActionState } from "@/lib/actions/types";
import type { DocumentComment, DocumentLink, DocumentRecord, DocumentTag, DocumentVersion } from "@/lib/types";

export function CreateDocumentForm({ workspaceId, folderId }: { workspaceId: string; folderId: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(createDocumentAction, {});
  return <form action={action} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="folderId" value={folderId ?? ""} /><Input name="title" placeholder="Document title" aria-label="Document title" required /><SubmitButton pendingLabel="Creating…">New document</SubmitButton>{state.error && <FormMessage error={state.error} />}</form>;
}

export function CreateDocumentFolderForm({ workspaceId, parentId }: { workspaceId: string; parentId: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(createDocumentFolderAction, {});
  return <form action={action} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="parentId" value={parentId ?? ""} /><Input name="name" placeholder="New folder name" aria-label="New document folder name" required /><SubmitButton pendingLabel="Creating…">Create folder</SubmitButton>{state.error && <FormMessage error={state.error} />}</form>;
}

export function DocumentFavoriteForm({ workspaceId, documentId, favorite }: { workspaceId: string; documentId: string; favorite: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(toggleDocumentFavoriteAction, {});
  return <form action={action}><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="documentId" value={documentId} /><input type="hidden" name="favorite" value={String(!favorite)} /><Button type="submit" variant="secondary" className="min-h-9 text-xs">{favorite ? "★ Favorited" : "☆ Add favorite"}</Button><FormMessage error={state.error} message={state.message} /></form>;
}

type DocMember = { user_id: string; profile?: { full_name?: string | null } | null };

export function DocumentSettingsPanel({ document, tags, shares, links, members, canEdit }: { document: DocumentRecord; tags: DocumentTag[]; shares: Array<{ id: string; user_id: string; permission: "read" | "edit" }>; links: DocumentLink[]; members: DocMember[]; canEdit: boolean }) {
  const [tagState, tagAction] = useActionState<ActionState, FormData>(saveDocumentTagsAction, {});
  const [shareState, shareAction] = useActionState<ActionState, FormData>(shareDocumentAction, {});
  const [removeShareState, removeShareAction] = useActionState<ActionState, FormData>(removeDocumentShareAction, {});
  const [linkState, linkAction] = useActionState<ActionState, FormData>(addDocumentLinkAction, {});
  const [removeLinkState, removeLinkAction] = useActionState<ActionState, FormData>(removeDocumentLinkAction, {});
  const [deleteState, deleteAction] = useActionState<ActionState, FormData>(deleteDocumentAction, {});
  const tagNames = tags.map((tag) => tag.name).join(", ");
  if (!canEdit) return <div className="rounded-2xl border border-[var(--line)] bg-sand/40 p-4 text-sm leading-6 text-[#667878]">This document is read-only for your account. Ask the owner for edit access.</div>;
  return <div className="space-y-4"><details className="rounded-2xl border border-[var(--line)] bg-white p-4" open><summary className="cursor-pointer text-sm font-semibold text-ink">Tags</summary><form action={tagAction} className="mt-3 flex gap-2"><input type="hidden" name="documentId" value={document.id} /><Input name="tags" defaultValue={tagNames} placeholder="planning, handbook" /><SubmitButton pendingLabel="Saving…">Save</SubmitButton></form><FormMessage error={tagState.error} message={tagState.message} /></details><details className="rounded-2xl border border-[var(--line)] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-ink">Share within workspace</summary><form action={shareAction} className="mt-3 space-y-2"><input type="hidden" name="documentId" value={document.id} /><Select name="userId" defaultValue=""><option value="">Choose member</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}</Select><div className="flex gap-2"><Select name="permission" defaultValue="read"><option value="read">Can view</option><option value="edit">Can edit</option></Select><SubmitButton pendingLabel="Sharing…">Share</SubmitButton></div></form><form action={removeShareAction} className="mt-3 flex gap-2"><input type="hidden" name="documentId" value={document.id} /><Select name="userId" defaultValue=""><option value="">Remove a share</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}</Select><SubmitButton pendingLabel="Removing…">Remove</SubmitButton></form><div className="mt-3 space-y-1 text-xs text-[#667878]">{shares.length ? shares.map((share) => <div key={share.id}>{members.find((member) => member.user_id === share.user_id)?.profile?.full_name || "Workspace member"} · {share.permission}</div>) : <p>No explicit shares yet.</p>}</div><FormMessage error={shareState.error ?? removeShareState.error} message={shareState.message ?? removeShareState.message} /></details><details className="rounded-2xl border border-[var(--line)] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-ink">Linked records</summary><form action={linkAction} className="mt-3 space-y-2"><input type="hidden" name="documentId" value={document.id} /><Select name="targetType" defaultValue="project">{DOCUMENT_LINK_TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</Select><Input name="targetId" placeholder="Target record UUID" required /><SubmitButton pendingLabel="Linking…">Add link</SubmitButton></form><div className="mt-3 space-y-2 text-xs text-[#667878]">{links.length ? links.map((link) => <div key={link.id} className="flex items-center justify-between gap-2"><span>{link.target_type} · {link.target_id}</span><form action={removeLinkAction}><input type="hidden" name="documentId" value={document.id} /><input type="hidden" name="linkId" value={link.id} /><Button type="submit" variant="ghost" className="min-h-7 px-1 text-xs text-coral">Remove</Button></form></div>) : <p>No linked records yet.</p>}</div><FormMessage error={linkState.error ?? removeLinkState.error} message={linkState.message ?? removeLinkState.message} /></details><form action={deleteAction} className="rounded-2xl border border-coral/20 bg-[#fff7f4] p-4"><input type="hidden" name="documentId" value={document.id} /><Button type="submit" variant="danger" className="min-h-9 text-xs">Move to recycle bin</Button><FormMessage error={deleteState.error} message={deleteState.message} /></form></div>;
}

export function DocumentCommentsPanel({ documentId, comments, members }: { documentId: string; comments: DocumentComment[]; members: DocMember[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addDocumentCommentAction, {});
  const resolveAction = async (formData: FormData): Promise<void> => {
    await resolveDocumentCommentAction({}, formData);
  };
  return <div className="space-y-4"><div className="space-y-3">{comments.length ? comments.map((comment) => <div key={comment.id} className={`rounded-2xl border p-4 ${comment.resolved_at ? "border-[var(--line)] bg-sand/30 opacity-70" : "border-[var(--line)] bg-white"}`}><div className="flex items-center justify-between gap-3"><div className="text-xs font-semibold text-ink">{comment.author?.full_name || "Workspace member"}{comment.line_number ? ` · line ${comment.line_number}` : ""}</div><form action={resolveAction}><input type="hidden" name="documentId" value={documentId} /><input type="hidden" name="commentId" value={comment.id} /><input type="hidden" name="resolved" value={String(!comment.resolved_at)} /><button type="submit" className="text-xs font-semibold text-moss">{comment.resolved_at ? "Reopen" : "Resolve"}</button></form></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#667878]">{comment.body}</p></div>) : <div className="rounded-xl bg-sand/50 p-4 text-sm text-[#667878]">No comments yet. Mention a teammate when you need a response.</div>}</div><form action={action} className="rounded-2xl border border-[var(--line)] bg-white p-4"><input type="hidden" name="documentId" value={documentId} /><textarea name="body" className="focus-ring min-h-24 w-full rounded-xl border border-[var(--line)] p-3 text-sm" placeholder="Leave a comment…" required /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Select name="mentionedUserId" defaultValue=""><option value="">Mention someone (optional)</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}</Select><SubmitButton pendingLabel="Adding…">Add comment</SubmitButton></div><FormMessage error={state.error} message={state.message} /></form></div>;
}

export function DocumentVersionHistory({ documentId, versions, canEdit }: { documentId: string; versions: DocumentVersion[]; canEdit: boolean }) {
  const restoreAction = async (formData: FormData): Promise<void> => {
    await restoreDocumentVersionAction({}, formData);
  };
  return <div className="space-y-2">{versions.length ? versions.map((version) => <div key={version.id} className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold text-ink">Version {version.version_number}</div><div className="text-xs text-[#8a9992]">{version.status} · {new Date(version.created_at).toLocaleString()}</div></div>{canEdit && <form action={restoreAction}><input type="hidden" name="documentId" value={documentId} /><input type="hidden" name="versionId" value={version.id} /><SubmitButton pendingLabel="Restoring…">Restore</SubmitButton></form>}</div>) : <p className="text-sm text-[#667878]">No saved versions yet.</p>}</div>;
}

export function RestoreDocumentForm({ documentId }: { documentId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(restoreDocumentAction, {});
  return <form action={action}><input type="hidden" name="documentId" value={documentId} /><SubmitButton>Restore document</SubmitButton><FormMessage error={state.error} message={state.message} /></form>;
}
