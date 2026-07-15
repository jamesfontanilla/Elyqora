import { createClient } from "@/lib/supabase/server";
import { getWorkspaceMembers } from "@/lib/workspaces/current";
import { formatTableCellValue, getTableValueSearchText, TABLE_EXPORT_ROW_LIMIT, TABLE_PAGE_SIZE, TABLE_ROW_WINDOW } from "@/lib/tables/constants";
import { serializeCsvRows } from "@/lib/tables/csv";
import type { TableColumn, TableFilterOperator, TableRow, TableRowActivity, TableRowComment, TableSortDirection, TableView, WorkspaceTable } from "@/lib/types";

export interface TablesOverviewRowCounts {
  rows: number;
  columns: number;
  views: number;
}

export interface TablesOverviewData {
  tables: WorkspaceTable[];
  totalTables: number;
  countsByTable: Record<string, TablesOverviewRowCounts>;
  recentActivity: Array<TableRowActivity & { actor?: { id: string; full_name: string; avatar_url: string | null } | null }>;
}

export interface TableViewState {
  table: WorkspaceTable;
  columns: TableColumn[];
  views: TableView[];
  activeView: TableView | null;
  rows: TableRow[];
  deletedRows: TableRow[];
  totalRows: number;
  page: number;
  totalPages: number;
  commentsByRowId: Record<string, TableRowComment[]>;
  recentActivity: Array<TableRowActivity & { actor?: { id: string; full_name: string; avatar_url: string | null } | null }>;
  memberLookup: Record<string, string>;
  visibleColumns: TableColumn[];
  hiddenColumns: TableColumn[];
  windowed: boolean;
}

export async function getTablesOverview(workspaceId: string, _userId: string, search = "", page = 1, pageSize = TABLE_PAGE_SIZE): Promise<TablesOverviewData> {
  const supabase = await createClient();
  const offset = Math.max(0, page - 1) * pageSize;
  let tableQuery = supabase.from("workspace_tables").select("*", { count: "exact" }).eq("workspace_id", workspaceId).is("deleted_at", null).order("updated_at", { ascending: false }).range(offset, offset + pageSize - 1);
  if (search) tableQuery = tableQuery.ilike("name", `%${search.replace(/[%_]/g, "\\$&").slice(0, 80)}%`);

  const [tablesResult, recentActivityResult] = await Promise.all([
    tableQuery,
    supabase.from("table_row_activity").select("*,actor:profiles(id,full_name,avatar_url)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).range(0, 11),
  ]);

  const tables = (tablesResult.data ?? []) as WorkspaceTable[];
  const tableIds = tables.map((table) => table.id);
  const [rowCountsResult, columnCountsResult, viewCountsResult] = await Promise.all([
    tableIds.length ? supabase.from("table_rows").select("table_id").eq("workspace_id", workspaceId).is("deleted_at", null).in("table_id", tableIds) : Promise.resolve({ data: [] as Array<{ table_id: string }> }),
    tableIds.length ? supabase.from("table_columns").select("table_id").eq("workspace_id", workspaceId).in("table_id", tableIds) : Promise.resolve({ data: [] as Array<{ table_id: string }> }),
    tableIds.length ? supabase.from("table_views").select("table_id").eq("workspace_id", workspaceId).in("table_id", tableIds) : Promise.resolve({ data: [] as Array<{ table_id: string }> }),
  ]);

  const countsByTable: Record<string, TablesOverviewRowCounts> = Object.fromEntries(tableIds.map((tableId) => [tableId, { rows: 0, columns: 0, views: 0 }]));
  for (const row of rowCountsResult.data ?? []) countsByTable[row.table_id].rows += 1;
  for (const row of columnCountsResult.data ?? []) countsByTable[row.table_id].columns += 1;
  for (const row of viewCountsResult.data ?? []) countsByTable[row.table_id].views += 1;

  return {
    tables,
    totalTables: tablesResult.count ?? 0,
    countsByTable,
    recentActivity: (recentActivityResult.data ?? []) as TablesOverviewData["recentActivity"],
  };
}

export async function getTableViewState({
  workspaceId,
  tableId,
  viewId,
  page,
  search,
  pageSize = TABLE_PAGE_SIZE,
}: {
  workspaceId: string;
  tableId: string;
  userId: string;
  viewId: string | null;
  page: number;
  search: string;
  pageSize?: number;
}): Promise<TableViewState | null> {
  const supabase = await createClient();
  const [tableResult, columnsResult, viewsResult, members, recentActivityResult, deletedRowsResult] = await Promise.all([
    supabase.from("workspace_tables").select("*").eq("workspace_id", workspaceId).eq("id", tableId).is("deleted_at", null).maybeSingle(),
    supabase.from("table_columns").select("*").eq("workspace_id", workspaceId).eq("table_id", tableId).order("position", { ascending: true }).range(0, 99),
    supabase.from("table_views").select("*").eq("workspace_id", workspaceId).eq("table_id", tableId).order("created_at", { ascending: true }).range(0, 49),
    getWorkspaceMembers(workspaceId),
    supabase.from("table_row_activity").select("*,actor:profiles(id,full_name,avatar_url)").eq("workspace_id", workspaceId).eq("table_id", tableId).order("created_at", { ascending: false }).range(0, 11),
    supabase.from("table_rows").select("*", { count: "exact" }).eq("workspace_id", workspaceId).eq("table_id", tableId).not("deleted_at", "is", null).order("updated_at", { ascending: false }).range(0, 11),
  ]);

  const table = (tableResult.data as WorkspaceTable | null) ?? null;
  if (!table) return null;

  const columns = (columnsResult.data ?? []) as TableColumn[];
  const views = (viewsResult.data ?? []) as TableView[];
  const activeView = viewId ? views.find((view) => view.id === viewId) ?? null : views.find((view) => view.is_default) ?? views[0] ?? null;
  const viewFilters = Array.isArray(activeView?.filter_rules) ? activeView?.filter_rules ?? [] : [];
  const viewSorts = Array.isArray(activeView?.sort_rules) ? activeView?.sort_rules ?? [] : [];
  const requiresWindow = Boolean(search || viewFilters.length || viewSorts.length);
  const rowQuery = supabase.from("table_rows").select("*", { count: "exact" }).eq("workspace_id", workspaceId).eq("table_id", tableId).is("deleted_at", null).order("row_order", { ascending: true });
  const rowsResult = requiresWindow
    ? await rowQuery.range(0, TABLE_ROW_WINDOW - 1)
    : await rowQuery.range(Math.max(0, page - 1) * pageSize, Math.max(0, page - 1) * pageSize + pageSize - 1);

  const allRows = (rowsResult.data ?? []) as TableRow[];
  const { rows, totalRows, visibleColumns, hiddenColumns, currentPage, totalPages } = applyTableViewState({
    rows: allRows,
    columns,
    page,
    pageSize,
    search,
    filters: viewFilters,
    sorts: viewSorts,
    view: activeView,
    windowed: requiresWindow,
  });

  const rowIds = rows.map((row) => row.id);
  const deletedRows = (deletedRowsResult.data ?? []) as TableRow[];
  const commentRowIds = [...rowIds, ...deletedRows.map((row) => row.id)];
  const commentsByRowId = commentRowIds.length
    ? await loadCommentsForRows(supabase, workspaceId, tableId, commentRowIds)
    : {};

  const memberLookup = Object.fromEntries((members ?? []).map((member) => {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
    return [member.user_id, profile?.full_name ?? "Workspace member"];
  }));

  return {
    table,
    columns,
    views,
    activeView,
    rows,
    deletedRows,
    totalRows,
    page: currentPage,
    totalPages,
    commentsByRowId,
    recentActivity: (recentActivityResult.data ?? []) as TableViewState["recentActivity"],
    memberLookup,
    visibleColumns,
    hiddenColumns,
    windowed: requiresWindow,
  };
}

export async function getTableExportCsv(workspaceId: string, tableId: string, viewId: string | null = null) {
  const state = await getTableViewState({ workspaceId, tableId, userId: "", viewId, page: 1, search: "", pageSize: TABLE_EXPORT_ROW_LIMIT });
  if (!state) return null;
  const exportColumns = state.visibleColumns.length > 0 ? state.visibleColumns : state.columns;
  const headers = exportColumns.map((column) => column.name);
  const rows = state.rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const column of exportColumns) {
      record[column.name] = formatTableCellValue(column, row.cell_values[column.id], state.memberLookup);
    }
    return record;
  });
  return {
    table: state.table,
    headers,
    csv: serializeCsvRows(headers, rows),
    rowCount: rows.length,
  };
}

export function applyTableViewState({
  rows,
  columns,
  page,
  pageSize,
  search,
  filters,
  sorts,
  view,
  windowed,
}: {
  rows: TableRow[];
  columns: TableColumn[];
  page: number;
  pageSize: number;
  search: string;
  filters: Array<{ column_id: string; operator: TableFilterOperator; value: string | number | boolean | null | string[] }>;
  sorts: Array<{ column_id: string; direction: TableSortDirection }>;
  view: TableView | null;
  windowed: boolean;
}) {
  const visibleColumnIds = new Set(view?.hidden_column_ids ?? []);
  const orderedColumns = resolveTableColumns(columns, view);
  const searchableColumns = orderedColumns.filter((column) => column.column_type !== "boolean");
  let visibleRows = rows.filter((row) => row.deleted_at === null);

  if (search) {
    const normalized = search.trim().toLowerCase();
    visibleRows = visibleRows.filter((row) => searchableColumns.some((column) => getTableValueSearchText(row.cell_values[column.id]).toLowerCase().includes(normalized)));
  }

  for (const filter of filters) {
    const column = columns.find((entry) => entry.id === filter.column_id);
    if (!column) continue;
    visibleRows = visibleRows.filter((row) => matchesTableFilter(column, row.cell_values[column.id], filter.operator, filter.value));
  }

  if (sorts.length > 0) {
    visibleRows = [...visibleRows].sort((left, right) => compareTableRows(columns, left, right, sorts));
  } else {
    visibleRows = [...visibleRows].sort((left, right) => (left.row_order - right.row_order) || new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  }

  const totalRows = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageRows = windowed ? visibleRows.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize) : visibleRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  const visibleColumns = orderedColumns.filter((column) => !visibleColumnIds.has(column.id));
  const hiddenColumns = orderedColumns.filter((column) => visibleColumnIds.has(column.id));

  return { rows: pageRows, totalRows, visibleColumns, hiddenColumns, currentPage, totalPages };
}

export function resolveTableColumns(columns: TableColumn[], view: TableView | null) {
  const order = view?.column_order ?? [];
  const orderedByView = order.length > 0
    ? [...columns].sort((left, right) => {
        const leftIndex = order.indexOf(left.id);
        const rightIndex = order.indexOf(right.id);
        if (leftIndex === -1 && rightIndex === -1) return left.position - right.position;
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      })
    : [...columns].sort((left, right) => left.position - right.position);
  return orderedByView;
}

export function matchesTableFilter(column: TableColumn, cellValue: unknown, operator: TableFilterOperator, targetValue: string | number | boolean | null | string[]): boolean {
  if (operator === "is_empty") return cellValue === null || cellValue === undefined || cellValue === "" || (Array.isArray(cellValue) && cellValue.length === 0);
  if (operator === "not_empty") return !matchesTableFilter(column, cellValue, "is_empty", null);

  if (column.column_type === "number" || column.column_type === "currency") {
    const current = typeof cellValue === "number" ? cellValue : Number(cellValue);
    const target = typeof targetValue === "number" ? targetValue : Number(targetValue);
    if (!Number.isFinite(current) || !Number.isFinite(target)) return false;
    if (operator === "greater_than") return current > target;
    if (operator === "less_than") return current < target;
    if (operator === "equals") return current === target;
    if (operator === "not_equals") return current !== target;
    return false;
  }

  if (column.column_type === "date" && typeof cellValue === "string") {
    const current = new Date(cellValue).getTime();
    const target = typeof targetValue === "string" ? new Date(targetValue).getTime() : NaN;
    if (!Number.isFinite(current) || !Number.isFinite(target)) return false;
    if (operator === "before") return current < target;
    if (operator === "after") return current > target;
    if (operator === "equals") return current === target;
    if (operator === "not_equals") return current !== target;
    return false;
  }

  const currentText = Array.isArray(cellValue) ? cellValue.join(", ") : getTableValueSearchText(cellValue);
  const targetText = Array.isArray(targetValue) ? targetValue.join(", ") : String(targetValue ?? "");

  if (operator === "contains") return currentText.toLowerCase().includes(targetText.toLowerCase());
  if (operator === "equals") return currentText.toLowerCase() === targetText.toLowerCase();
  if (operator === "not_equals") return currentText.toLowerCase() !== targetText.toLowerCase();
  return false;
}

export function compareTableRows(columns: TableColumn[], left: TableRow, right: TableRow, sorts: Array<{ column_id: string; direction: TableSortDirection }>) {
  for (const sort of sorts) {
    const column = columns.find((entry) => entry.id === sort.column_id);
    if (!column) continue;
    const leftValue = left.cell_values[column.id];
    const rightValue = right.cell_values[column.id];
    const leftText = Array.isArray(leftValue) ? leftValue.join(", ") : getTableValueSearchText(leftValue);
    const rightText = Array.isArray(rightValue) ? rightValue.join(", ") : getTableValueSearchText(rightValue);
    let result = 0;
    if (column.column_type === "number" || column.column_type === "currency") {
      result = (Number(leftValue) || 0) - (Number(rightValue) || 0);
    } else if (column.column_type === "date") {
      result = new Date(leftText).getTime() - new Date(rightText).getTime();
    } else {
      result = leftText.localeCompare(rightText);
    }
    if (result !== 0) return sort.direction === "asc" ? result : -result;
  }
  return (left.row_order - right.row_order) || new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
}

async function loadCommentsForRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  tableId: string,
  rowIds: string[],
) {
  const { data } = await supabase.from("table_row_comments").select("*,author:profiles(id,full_name,avatar_url)").eq("workspace_id", workspaceId).eq("table_id", tableId).in("row_id", rowIds).order("created_at", { ascending: true }).range(0, 199);
  const comments = (data ?? []) as TableRowComment[];
  return comments.reduce<Record<string, TableRowComment[]>>((map, comment) => {
    (map[comment.row_id] ??= []).push(comment);
    return map;
  }, {});
}
