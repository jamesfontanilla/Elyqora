import type { DocumentSharePermission, DocumentStatus, DocumentVisibility } from "@/lib/types";

export interface DocumentAuthorizationInput {
  userId: string;
  workspaceId: string;
  isWorkspaceMember: boolean;
  canManageDocs?: boolean;
  document: {
    id: string;
    workspace_id: string;
    created_by: string;
    status: DocumentStatus;
    visibility: DocumentVisibility;
    deleted_at?: string | null;
  };
  sharePermission?: DocumentSharePermission | null;
}

export function canReadDocument(input: DocumentAuthorizationInput): boolean {
  const { document } = input;

  if (document.deleted_at || document.workspace_id !== input.workspaceId) {
    return false;
  }

  if (document.visibility === "public" && document.status === "published") {
    return true;
  }

  if (!input.isWorkspaceMember) {
    return false;
  }

  return (
    document.visibility === "workspace" ||
    document.created_by === input.userId ||
    input.sharePermission === "read" ||
    input.sharePermission === "edit"
  );
}

export function canEditDocument(input: DocumentAuthorizationInput): boolean {
  const { document } = input;

  if (
    document.deleted_at ||
    document.workspace_id !== input.workspaceId ||
    !input.isWorkspaceMember
  ) {
    return false;
  }

  return (
    document.created_by === input.userId ||
    input.canManageDocs === true ||
    input.sharePermission === "edit"
  );
}

export function canRestoreDocumentVersion(
  input: DocumentAuthorizationInput & { versionDocumentId: string },
): boolean {
  return input.versionDocumentId === input.document.id && canEditDocument(input);
}
