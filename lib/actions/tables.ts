"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { requireUser, requireWorkspacePermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { coerceTableCellValue, sanitizeTableColumnName, sanitizeTableDescription, sanitizeTableName, TABLE_EXPORT_ROW_LIMIT, TABLE_IMPORT_FILE_SIZE_LIMIT_BYTES, TABLE_IMPORT_ROW_LIMIT, TABLE_MAX_COMMENT_LENGTH, TABLE_MAX_COLUMNS, uniqueTableColumnKey, validateTableColumnSettings } from "@/lib/tables/constants";
import { parseCsvText } from "@/lib/tables/csv";
import { getTableValueSearchText } from "@/lib/tables/constants";
import type { TableColumn } from "@/lib/types";

const tableIdSchema = z.string().uuid();
const workspaceIdSchema = z.string().uuid();
const rowIdSchema = z.string().uuid();
const columnIdSchema = z.string().uuid();
const viewIdSchema = z.string().uuid();
const tableColumnTypeSchema = z.enum(["text", "long_text", "number", "currency", "boolean", "date", "single_select", "multi_select", "url", "user_reference"]);
const tableFilterOperatorSchema = z.enum(["contains", "equals", "not_equals", "is_empty", "not_empty", "greater_than", "less_than", "before", "after"]);
const tableSortDirectionSchema = z.enum(["asc", "desc"]);
const duplicateStrategySchema = z.enum(["skip", "replace", "error", "append"]);

async function loadTableForWrite(workspaceId: string, tableId: string, permission: Parameters<typeof requireWorkspacePermission>[1]) {
  await requireWorkspacePermission(workspaceId, permission);
  const supabase = await createClient();
  const { data: table } = await supabase.from("workspace_tables").select("*").eq("workspace_id", workspaceId).eq("id", tableId).maybeSingle();
  if (!table) throw new Error("The table could not be found.");
  return { supabase, table };
}

async function loadTableColumns(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, tableId: string) {
  const { data } = await supabase.from("table_columns").select("*").eq("workspace_id", workspaceId).eq("table_id", tableId).order("position", { ascending: true }).range(0, 99);
  return (data ?? []) as TableColumn[];
}

function parseBoolean(formDataValue: FormDataEntryValue | null) {
  return formDataValue === "true" || formDataValue === "on" || formDataValue === "1";
}

function splitOptions(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);
}

function collectColumnValues(formData: FormData, columns: TableColumn[]) {
  const values: Record<string, unknown> = {};
  for (const column of columns) {
    const parsed = coerceTableCellValue(column, String(formData.get(`cell_${column.id}`) ?? ""));
    if (!parsed.ok) return parsed;
    values[column.id] = parsed.value;
  }
  return { ok: true as const, values };
}

export async function createTableAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const name = z.string().trim().min(2).max(120).safeParse(formData.get("name"));
  const description = z.string().trim().max(240).safeParse(String(formData.get("description") ?? ""));
  if (!workspaceId.success || !name.success || !description.success) return { error: "Check the table name and description." };

  try {
    const user = await requireUser();
    await requireWorkspacePermission(workspaceId.data, "tables.write");
    const supabase = await createClient();
    const { data, error } = await supabase.from("workspace_tables").insert({
      workspace_id: workspaceId.data,
      name: sanitizeTableName(name.data),
      description: sanitizeTableDescription(description.data ?? ""),
      created_by: user.id,
      updated_by: user.id,
    }).select("*").single();
    if (error) return { error: error.message };
    const tableRow = data as { id: string } | null;
    if (!tableRow?.id) return { error: "The table could not be created." };
    revalidatePath("/tables");
    redirect(`/tables/${tableRow.id}`);
  } catch (error) {
    return actionError(error);
  }
  return { error: "The table could not be created." };
}

export async function saveTableMetadataAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const name = z.string().trim().min(2).max(120).safeParse(formData.get("name"));
  const description = z.string().trim().max(240).safeParse(formData.get("description"));
  if (!workspaceId.success || !tableId.success || !name.success || !description.success) return { error: "Check the table details." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const { error } = await supabase.from("workspace_tables").update({
      name: sanitizeTableName(name.data),
      description: sanitizeTableDescription(description.data),
      updated_by: (await requireUser()).id,
    }).eq("id", tableId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    revalidatePath("/tables");
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Table saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTableAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const confirmation = z.string().trim().safeParse(formData.get("confirmation"));
  const tableName = z.string().trim().min(1).safeParse(formData.get("tableName"));
  if (!workspaceId.success || !tableId.success || !confirmation.success || !tableName.success || confirmation.data !== tableName.data) {
    return { error: "Type the table name exactly to confirm deletion." };
  }

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.manage");
    const { error } = await supabase.from("workspace_tables").update({
      deleted_at: new Date().toISOString(),
      deleted_by: (await requireUser()).id,
      updated_by: (await requireUser()).id,
    }).eq("id", tableId.data).eq("workspace_id", workspaceId.data).is("deleted_at", null);
    if (error) return { error: error.message };
    revalidatePath("/tables");
    redirect("/tables");
  } catch (error) {
    return actionError(error);
  }
  return { error: "The table could not be deleted." };
}

export async function saveTableColumnAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const columnId = String(formData.get("columnId") ?? "");
  const maybeColumnId = columnId ? columnIdSchema.safeParse(columnId) : { success: true as const, data: null };
  const name = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  const type = tableColumnTypeSchema.safeParse(formData.get("columnType"));
  const required = parseBoolean(formData.get("isRequired"));
  const hidden = parseBoolean(formData.get("isHidden"));
  const options = splitOptions(formData.get("options"));
  const precision = z.coerce.number().int().min(0).max(6).safeParse(formData.get("precision"));
  const currencyCode = z.string().trim().max(3).safeParse(formData.get("currencyCode"));
  if (!workspaceId.success || !tableId.success || !maybeColumnId.success || !name.success || !type.success || !precision.success || !currencyCode.success) {
    return { error: "Check the column details." };
  }

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const columns = await loadTableColumns(supabase, workspaceId.data, tableId.data);
    const normalized = validateTableColumnSettings(type.data, {
      options,
      precision: precision.data,
      currency_code: currencyCode.data || undefined,
    });
    if (!normalized.ok) return { error: normalized.error };

    if (maybeColumnId.data) {
      const { error } = await supabase.from("table_columns").update({
        name: sanitizeTableColumnName(name.data),
        column_type: type.data,
        is_required: required,
        is_hidden: hidden,
        settings: normalized.settings,
        updated_by: (await requireUser()).id,
      }).eq("id", maybeColumnId.data).eq("table_id", tableId.data).eq("workspace_id", workspaceId.data);
      if (error) return { error: error.message };
      revalidatePath(`/tables/${tableId.data}`);
      return { message: "Column updated." };
    }

    if (columns.length >= TABLE_MAX_COLUMNS) return { error: `A table can only have up to ${TABLE_MAX_COLUMNS} columns.` };
    const columnKey = uniqueTableColumnKey(name.data, columns.map((column) => column.column_key));
    const { error } = await supabase.from("table_columns").insert({
      workspace_id: workspaceId.data,
      table_id: tableId.data,
      name: sanitizeTableColumnName(name.data),
      column_key: columnKey,
      column_type: type.data,
      position: columns.length,
      is_hidden: hidden,
      is_required: required,
      settings: normalized.settings,
      created_by: (await requireUser()).id,
      updated_by: (await requireUser()).id,
    });
    if (error) return { error: error.message };
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Column added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveTableColumnAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const columnId = columnIdSchema.safeParse(formData.get("columnId"));
  const direction = z.enum(["up", "down"]).safeParse(formData.get("direction"));
  if (!workspaceId.success || !tableId.success || !columnId.success || !direction.success) return { error: "Choose a valid column move." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const { data: columns } = await supabase.from("table_columns").select("id,position").eq("workspace_id", workspaceId.data).eq("table_id", tableId.data).order("position", { ascending: true });
    const ordered = columns ?? [];
    const index = ordered.findIndex((column) => column.id === columnId.data);
    const targetIndex = direction.data === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return { error: "That column cannot move any further." };
    const current = ordered[index];
    const target = ordered[targetIndex];
    const userId = (await requireUser()).id;
    const { error: firstError } = await supabase.from("table_columns").update({ position: target.position, updated_by: userId }).eq("id", current.id).eq("table_id", tableId.data);
    if (firstError) return { error: firstError.message };
    const { error: secondError } = await supabase.from("table_columns").update({ position: current.position, updated_by: userId }).eq("id", target.id).eq("table_id", tableId.data);
    if (secondError) return { error: secondError.message };
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Column order updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleTableColumnHiddenAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const columnId = columnIdSchema.safeParse(formData.get("columnId"));
  const hidden = parseBoolean(formData.get("hidden"));
  if (!workspaceId.success || !tableId.success || !columnId.success) return { error: "Choose a valid column." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const { error } = await supabase.from("table_columns").update({ is_hidden: hidden, updated_by: (await requireUser()).id }).eq("id", columnId.data).eq("table_id", tableId.data);
    if (error) return { error: error.message };
    revalidatePath(`/tables/${tableId.data}`);
    return { message: hidden ? "Column hidden." : "Column shown." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveTableRowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const rowIdValue = String(formData.get("rowId") ?? "");
  const rowId = rowIdValue ? rowIdSchema.safeParse(rowIdValue) : { success: true as const, data: null };
  if (!workspaceId.success || !tableId.success || !rowId.success) return { error: "Select a valid row." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const columns = await loadTableColumns(supabase, workspaceId.data, tableId.data);
    const parsedValues = collectColumnValues(formData, columns);
    if (!parsedValues.ok) return { error: parsedValues.error };

    const userId = (await requireUser()).id;
    if (rowId.data) {
      const { error } = await supabase.from("table_rows").update({ cell_values: parsedValues.values, updated_by: userId }).eq("id", rowId.data).eq("table_id", tableId.data).eq("workspace_id", workspaceId.data);
      if (error) return { error: error.message };
      revalidatePath(`/tables/${tableId.data}`);
      return { message: "Row updated." };
    }

    const { data: latestRow } = await supabase.from("table_rows").select("row_order").eq("workspace_id", workspaceId.data).eq("table_id", tableId.data).is("deleted_at", null).order("row_order", { ascending: false }).limit(1).maybeSingle();
    const nextRowOrder = typeof latestRow?.row_order === "number" ? latestRow.row_order + 1 : 0;
    const { error } = await supabase.from("table_rows").insert({
      workspace_id: workspaceId.data,
      table_id: tableId.data,
      row_order: nextRowOrder,
      cell_values: parsedValues.values,
      created_by: userId,
      updated_by: userId,
    });
    if (error) return { error: error.message };
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Row added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTableRowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const rowId = rowIdSchema.safeParse(formData.get("rowId"));
  if (!workspaceId.success || !tableId.success || !rowId.success) return { error: "Select a valid row." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const userId = (await requireUser()).id;
    const { error } = await supabase.from("table_rows").update({ deleted_at: new Date().toISOString(), deleted_by: userId, updated_by: userId }).eq("id", rowId.data).eq("table_id", tableId.data).eq("workspace_id", workspaceId.data).is("deleted_at", null);
    if (error) return { error: error.message };
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Row moved to the recycle bin." };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreTableRowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const rowId = rowIdSchema.safeParse(formData.get("rowId"));
  if (!workspaceId.success || !tableId.success || !rowId.success) return { error: "Select a valid row." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.manage");
    const userId = (await requireUser()).id;
    const { error } = await supabase.from("table_rows").update({ deleted_at: null, deleted_by: null, updated_by: userId }).eq("id", rowId.data).eq("table_id", tableId.data).eq("workspace_id", workspaceId.data).not("deleted_at", "is", null);
    if (error) return { error: error.message };
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Row restored." };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveTableViewAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const viewIdValue = String(formData.get("viewId") ?? "");
  const viewId = viewIdValue ? viewIdSchema.safeParse(viewIdValue) : { success: true as const, data: null };
  const name = z.string().trim().min(1).max(120).safeParse(formData.get("name"));
  const isDefault = parseBoolean(formData.get("isDefault"));
  const filterColumnIdValue = String(formData.get("filterColumnId") ?? "");
  const filterOperator = tableFilterOperatorSchema.safeParse(formData.get("filterOperator"));
  const sortColumnIdValue = String(formData.get("sortColumnId") ?? "");
  const sortDirection = tableSortDirectionSchema.safeParse(formData.get("sortDirection"));
  if (!workspaceId.success || !tableId.success || !viewId.success || !name.success || !filterOperator.success || !sortDirection.success) {
    return { error: "Check the view details." };
  }

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const columns = await loadTableColumns(supabase, workspaceId.data, tableId.data);
    const columnOrder = columns.map((column) => column.id);
    const hiddenColumnIds = formData.getAll("hiddenColumnIds").map((value) => String(value)).filter((value) => /^([0-9a-f-]{36})$/i.test(value));
    const filterColumn = filterColumnIdValue ? columns.find((column) => column.id === filterColumnIdValue) : null;
    const sortColumn = sortColumnIdValue ? columns.find((column) => column.id === sortColumnIdValue) : null;
    const filterRules = filterColumn
      ? (() => {
          const parsed = coerceTableCellValue(filterColumn, String(formData.get("filterValue") ?? ""));
          if (!parsed.ok) throw new Error(parsed.error);
          return [{ column_id: filterColumn.id, operator: filterOperator.data, value: parsed.value }];
        })()
      : [];
    const sortRules = sortColumn ? [{ column_id: sortColumn.id, direction: sortDirection.data }] : [];

    if (viewId.data) {
      const { error } = await supabase.from("table_views").update({
        name: name.data,
        is_default: isDefault,
        filter_rules: filterRules,
        sort_rules: sortRules,
        hidden_column_ids: hiddenColumnIds,
        column_order: columnOrder,
        updated_by: (await requireUser()).id,
      }).eq("id", viewId.data).eq("table_id", tableId.data).eq("workspace_id", workspaceId.data);
      if (error) return { error: error.message };
      if (isDefault) {
        await supabase.from("table_views").update({ is_default: false, updated_by: (await requireUser()).id }).eq("table_id", tableId.data).neq("id", viewId.data);
      }
      revalidatePath(`/tables/${tableId.data}`);
      return { message: "View saved." };
    }

    const { error } = await supabase.from("table_views").insert({
      workspace_id: workspaceId.data,
      table_id: tableId.data,
      name: name.data,
      is_default: isDefault,
      filter_rules: filterRules,
      sort_rules: sortRules,
      hidden_column_ids: hiddenColumnIds,
      column_order: columnOrder,
      created_by: (await requireUser()).id,
      updated_by: (await requireUser()).id,
    });
    if (error) return { error: error.message };
    if (isDefault) {
      await supabase.from("table_views").update({ is_default: false, updated_by: (await requireUser()).id }).eq("table_id", tableId.data).is("is_default", true);
      await supabase.from("table_views").update({ is_default: true, updated_by: (await requireUser()).id }).eq("table_id", tableId.data).eq("name", name.data);
    }
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "View created." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addTableRowCommentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const rowId = rowIdSchema.safeParse(formData.get("rowId"));
  const body = z.string().trim().min(1).max(TABLE_MAX_COMMENT_LENGTH).safeParse(formData.get("body"));
  if (!workspaceId.success || !tableId.success || !rowId.success || !body.success) return { error: "Write a comment before saving." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const userId = (await requireUser()).id;
    const { error } = await supabase.from("table_row_comments").insert({
      workspace_id: workspaceId.data,
      table_id: tableId.data,
      row_id: rowId.data,
      author_id: userId,
      body: body.data,
    });
    if (error) return { error: error.message };
    await supabase.from("table_row_activity").insert({
      workspace_id: workspaceId.data,
      table_id: tableId.data,
      row_id: rowId.data,
      actor_id: userId,
      action: "comment.created",
      metadata: { body: body.data.slice(0, 120) },
    });
    revalidatePath(`/tables/${tableId.data}`);
    return { message: "Comment added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function importTableCsvAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = workspaceIdSchema.safeParse(formData.get("workspaceId"));
  const tableId = tableIdSchema.safeParse(formData.get("tableId"));
  const duplicateStrategy = duplicateStrategySchema.safeParse(formData.get("duplicateStrategy"));
  const keyColumnIdValue = String(formData.get("keyColumnId") ?? "");
  const keyColumnId = keyColumnIdValue ? columnIdSchema.safeParse(keyColumnIdValue) : { success: true as const, data: null };
  const file = formData.get("csvFile");
  if (!workspaceId.success || !tableId.success || !duplicateStrategy.success || !keyColumnId.success) return { error: "Check the CSV import settings." };
  if (!(file instanceof File)) return { error: "Choose a CSV file to import." };
  if (file.size > TABLE_IMPORT_FILE_SIZE_LIMIT_BYTES) return { error: "The CSV file is too large for a lightweight import." };

  try {
    const { supabase } = await loadTableForWrite(workspaceId.data, tableId.data, "tables.write");
    const columns = await loadTableColumns(supabase, workspaceId.data, tableId.data);
    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) return { error: "The CSV file did not include any rows to import." };
    if (parsed.rows.length > TABLE_IMPORT_ROW_LIMIT) return { error: `Imports are limited to ${TABLE_IMPORT_ROW_LIMIT} rows at a time.` };

    const mappings = parsed.headers.map((_, index) => String(formData.get(`mapping_${index}`) ?? ""));
    const mappedColumnIds = mappings.filter(Boolean);
    if (mappedColumnIds.length === 0) return { error: "Map at least one CSV column to a table column." };
    if (new Set(mappedColumnIds).size !== mappedColumnIds.length) return { error: "Map each CSV column to a unique table column." };

    const existingRowsResult = keyColumnId.data
      ? await supabase.from("table_rows").select("id,row_order,cell_values").eq("workspace_id", workspaceId.data).eq("table_id", tableId.data).is("deleted_at", null).range(0, TABLE_EXPORT_ROW_LIMIT - 1)
      : { data: [] as Array<{ id: string; row_order: number; cell_values: Record<string, unknown> }> };
    const existingRows = (existingRowsResult.data ?? []) as Array<{ id: string; row_order: number; cell_values: Record<string, unknown> }>;
    const existingByKey = new Map<string, { id: string; row_order: number; cell_values: Record<string, unknown> }>();
    if (keyColumnId.data) {
      for (const row of existingRows) {
        const keyValue = getTableValueSearchText(row.cell_values[keyColumnId.data]);
        if (keyValue) existingByKey.set(keyValue.toLowerCase(), row);
      }
    }

    const userId = (await requireUser()).id;
    let nextRowOrder = existingRows.length ? Math.max(...existingRows.map((row) => row.row_order)) + 1 : 0;
    let imported = 0;
    let replaced = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      const cellValues: Record<string, unknown> = {};
      for (const [index, csvValue] of row.entries()) {
        const columnId = mappings[index];
        if (!columnId) continue;
        const column = columns.find((entry) => entry.id === columnId);
        if (!column) return { error: `The mapped column for CSV header "${parsed.headers[index]}" no longer exists.` };
        const parsedValue = coerceTableCellValue(column, csvValue ?? "");
        if (!parsedValue.ok) return { error: `CSV row ${imported + skipped + replaced + 2}, ${parsed.headers[index]}: ${parsedValue.error}` };
        cellValues[columnId] = parsedValue.value;
      }

      if (keyColumnId.data) {
        const keyValue = getTableValueSearchText(cellValues[keyColumnId.data]).toLowerCase();
        if (keyValue) {
          const existingRow = existingByKey.get(keyValue);
          if (existingRow) {
            if (duplicateStrategy.data === "error") return { error: `Duplicate value "${keyValue}" already exists in the selected key column.` };
            if (duplicateStrategy.data === "skip") {
              skipped += 1;
              continue;
            }
            if (duplicateStrategy.data === "replace") {
              const { error } = await supabase.from("table_rows").update({ cell_values: cellValues, updated_by: userId }).eq("id", existingRow.id).eq("table_id", tableId.data);
              if (error) return { error: error.message };
              replaced += 1;
              continue;
            }
          }
        }
      }

      const { error } = await supabase.from("table_rows").insert({
        workspace_id: workspaceId.data,
        table_id: tableId.data,
        row_order: nextRowOrder,
        cell_values: cellValues,
        created_by: userId,
        updated_by: userId,
      });
      if (error) return { error: error.message };
      nextRowOrder += 1;
      imported += 1;
    }

    revalidatePath(`/tables/${tableId.data}`);
    return { message: `Imported ${imported} row${imported === 1 ? "" : "s"}${replaced ? `, replaced ${replaced}` : ""}${skipped ? `, skipped ${skipped}` : ""}.` };
  } catch (error) {
    return actionError(error);
  }
}
