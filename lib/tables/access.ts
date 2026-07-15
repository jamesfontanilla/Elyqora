import type { TableColumnType } from "@/lib/types";

export interface TableAccessContext {
  userId: string;
  workspaceId: string;
  tableWorkspaceId: string;
  membershipStatus: string;
  canReadTables: boolean;
  canWriteTables: boolean;
  canManageTables: boolean;
}

export function canReadTableRecord(context: Pick<TableAccessContext, "workspaceId" | "tableWorkspaceId" | "membershipStatus" | "canReadTables">) {
  return context.workspaceId === context.tableWorkspaceId && context.membershipStatus === "active" && context.canReadTables;
}

export function canEditTableRecord(context: Pick<TableAccessContext, "workspaceId" | "tableWorkspaceId" | "membershipStatus" | "canReadTables" | "canWriteTables">) {
  return canReadTableRecord(context) && context.canWriteTables;
}

export function canManageTableRecord(context: Pick<TableAccessContext, "workspaceId" | "tableWorkspaceId" | "membershipStatus" | "canReadTables" | "canManageTables">) {
  return canReadTableRecord(context) && context.canManageTables;
}

export function isTableColumnType(value: string): value is TableColumnType {
  return value === "text"
    || value === "long_text"
    || value === "number"
    || value === "currency"
    || value === "boolean"
    || value === "date"
    || value === "single_select"
    || value === "multi_select"
    || value === "url"
    || value === "user_reference";
}
