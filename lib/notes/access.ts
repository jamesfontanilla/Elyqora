import type { NoteScope, NoteVisibility } from "@/lib/types";

export interface NoteAccessContext {
  workspaceId: string;
  noteWorkspaceId: string;
  noteScope: NoteScope;
  noteVisibility: NoteVisibility;
  membershipStatus: string;
  createdBy: string;
  userId: string;
  canReadNotes: boolean;
  canWriteNotes: boolean;
  canManageNotes: boolean;
  isDeleted?: boolean;
}

export function canReadNoteRecord(context: Pick<NoteAccessContext, "workspaceId" | "noteWorkspaceId" | "noteScope" | "noteVisibility" | "membershipStatus" | "createdBy" | "userId" | "canReadNotes" | "canManageNotes" | "isDeleted">) {
  if (context.workspaceId !== context.noteWorkspaceId || context.membershipStatus !== "active") return false;
  if (context.noteScope === "personal") {
    return context.createdBy === context.userId;
  }
  if (context.isDeleted) return context.createdBy === context.userId || context.canManageNotes;
  if (context.noteVisibility === "workspace") return context.canReadNotes;
  return context.createdBy === context.userId || context.canManageNotes;
}

export function canEditNoteRecord(context: Pick<NoteAccessContext, "workspaceId" | "noteWorkspaceId" | "noteScope" | "noteVisibility" | "membershipStatus" | "createdBy" | "userId" | "canReadNotes" | "canWriteNotes" | "canManageNotes" | "isDeleted">) {
  if (!canReadNoteRecord(context)) return false;
  if (context.isDeleted) return false;
  if (context.noteScope === "personal") return context.createdBy === context.userId;
  if (context.noteVisibility === "workspace") return context.canWriteNotes;
  return context.createdBy === context.userId || context.canManageNotes;
}

export function canManageNoteRecord(context: Pick<NoteAccessContext, "workspaceId" | "noteWorkspaceId" | "noteScope" | "noteVisibility" | "membershipStatus" | "createdBy" | "userId" | "canManageNotes" | "isDeleted">) {
  if (context.workspaceId !== context.noteWorkspaceId || context.membershipStatus !== "active") return false;
  if (context.noteScope === "personal") return context.createdBy === context.userId;
  return context.canManageNotes;
}
