"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/auth/submit-button";
import { addTableRowCommentAction, createTableAction, deleteTableAction, deleteTableRowAction, importTableCsvAction, moveTableColumnAction, restoreTableRowAction, saveTableColumnAction, saveTableMetadataAction, saveTableRowAction, saveTableViewAction, toggleTableColumnHiddenAction } from "@/lib/actions/tables";
import { TABLE_COLUMN_TYPES, TABLE_FILTER_OPERATORS, TABLE_SORT_DIRECTIONS, formatTableCellValue, getTableColumnTypeLabel } from "@/lib/tables/constants";
import { mapCsvHeadersToColumns, parseCsvPreviewRows, parseCsvText } from "@/lib/tables/csv";
import type { ActionState } from "@/lib/actions/types";
import type { TableColumn, TableRow, TableRowComment, TableView, WorkspaceTable } from "@/lib/types";

type Member = { user_id: string; profile?: { full_name?: string | null; avatar_url?: string | null } | null };

export function CreateTableForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createTableAction, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <Input name="name" placeholder="Table name" aria-label="Table name" required />
        <Input name="description" placeholder="Short description" aria-label="Table description" />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton><Plus size={15} className="mr-1.5" />Create table</SubmitButton>
    </form>
  );
}

export function TableMetadataForm({ workspaceId, table }: { workspaceId: string; table: WorkspaceTable }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTableMetadataAction, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="tableId" value={table.id} />
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <Input name="name" defaultValue={table.name} aria-label="Table name" required />
        <Input name="description" defaultValue={table.description} aria-label="Table description" />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>Save table</SubmitButton>
    </form>
  );
}

export function DeleteTableForm({ workspaceId, table }: { workspaceId: string; table: WorkspaceTable }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteTableAction, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-coral/20 bg-[#fff7f4] p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="tableId" value={table.id} />
      <input type="hidden" name="tableName" value={table.name} />
      <Input name="confirmation" placeholder={`Type ${table.name}`} aria-label="Confirm table delete" required />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel="Deleting…">Delete table</SubmitButton>
    </form>
  );
}

export function TableColumnForm({ workspaceId, tableId, column, onClose }: { workspaceId: string; tableId: string; column?: TableColumn | null; onClose?: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTableColumnAction, {});
  const [type, setType] = useState<TableColumn["column_type"]>(column?.column_type ?? "text");

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="columnId" value={column?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" defaultValue={column?.name ?? ""} placeholder="Column name" aria-label="Column name" required />
        <Select name="columnType" value={type} onChange={(event) => setType(event.target.value as TableColumn["column_type"])} aria-label="Column type">
          {TABLE_COLUMN_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="isRequired" defaultChecked={column?.is_required ?? false} className="h-4 w-4 accent-[#3b6b58]" />Required</label>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="isHidden" defaultChecked={column?.is_hidden ?? false} className="h-4 w-4 accent-[#3b6b58]" />Hidden</label>
      </div>
      {(type === "single_select" || type === "multi_select") && <Input name="options" defaultValue={Array.isArray(column?.settings.options) ? column?.settings.options.join(", ") : ""} placeholder="Option A, Option B" aria-label="Column options" />}
      {type === "currency" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="currencyCode" defaultValue={column?.settings.currency_code ?? "USD"} placeholder="USD" aria-label="Currency code" />
          <Input name="precision" type="number" min="0" max="6" defaultValue={column?.settings.precision ?? 2} aria-label="Currency precision" />
        </div>
      )}
      <FormMessage error={state.error} message={state.message} />
      <div className="flex items-center gap-2">
        <SubmitButton>{column ? "Save column" : "Add column"}</SubmitButton>
        {onClose && <Button type="button" variant="ghost" onClick={onClose}>Close</Button>}
      </div>
    </form>
  );
}

export function TableColumnActions({ workspaceId, tableId, column }: { workspaceId: string; tableId: string; column: TableColumn }) {
  const [upState, upAction] = useActionState<ActionState, FormData>(moveTableColumnAction, {});
  const [downState, downAction] = useActionState<ActionState, FormData>(moveTableColumnAction, {});
  const [hiddenState, hiddenAction] = useActionState<ActionState, FormData>(toggleTableColumnHiddenAction, {});

  return (
    <div className="flex items-center gap-2 text-xs">
      <form action={upAction}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="columnId" value={column.id} />
        <input type="hidden" name="direction" value="up" />
        <Button type="submit" variant="ghost" className="min-h-8 px-2"><ChevronUp size={14} /></Button>
      </form>
      <form action={downAction}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="columnId" value={column.id} />
        <input type="hidden" name="direction" value="down" />
        <Button type="submit" variant="ghost" className="min-h-8 px-2"><ChevronDown size={14} /></Button>
      </form>
      <form action={hiddenAction}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="columnId" value={column.id} />
        <input type="hidden" name="hidden" value={String(!column.is_hidden)} />
        <Button type="submit" variant="ghost" className="min-h-8 px-2">{column.is_hidden ? "Show" : "Hide"}</Button>
      </form>
      <FormMessage error={hiddenState.error ?? upState.error ?? downState.error} message={hiddenState.message ?? upState.message ?? downState.message} />
    </div>
  );
}

function TableCellField({ column, defaultValue, members }: { column: TableColumn; defaultValue: unknown; members: Member[] }) {
  const label = `${column.name} (${getTableColumnTypeLabel(column.column_type)})`;
  if (column.column_type === "long_text") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Textarea name={`cell_${column.id}`} defaultValue={typeof defaultValue === "string" ? defaultValue : ""} aria-label={label} /></label>;
  }
  if (column.column_type === "single_select") {
    const options = Array.isArray(column.settings.options) ? column.settings.options : [];
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Select name={`cell_${column.id}`} defaultValue={typeof defaultValue === "string" ? defaultValue : ""} aria-label={label}><option value="">Select an option</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>;
  }
  if (column.column_type === "multi_select") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Textarea name={`cell_${column.id}`} defaultValue={Array.isArray(defaultValue) ? defaultValue.join(", ") : ""} placeholder="Option A, Option B" aria-label={label} /></label>;
  }
  if (column.column_type === "boolean") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Select name={`cell_${column.id}`} defaultValue={typeof defaultValue === "boolean" ? String(defaultValue) : ""} aria-label={label}><option value="">Choose one</option><option value="true">Yes</option><option value="false">No</option></Select></label>;
  }
  if (column.column_type === "date") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Input name={`cell_${column.id}`} type="date" defaultValue={typeof defaultValue === "string" ? defaultValue : ""} aria-label={label} /></label>;
  }
  if (column.column_type === "number" || column.column_type === "currency") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Input name={`cell_${column.id}`} type="number" step="any" defaultValue={typeof defaultValue === "number" ? defaultValue : typeof defaultValue === "string" ? defaultValue : ""} aria-label={label} /></label>;
  }
  if (column.column_type === "url") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Input name={`cell_${column.id}`} type="url" defaultValue={typeof defaultValue === "string" ? defaultValue : ""} aria-label={label} /></label>;
  }
  if (column.column_type === "user_reference") {
    return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Select name={`cell_${column.id}`} defaultValue={typeof defaultValue === "string" ? defaultValue : ""} aria-label={label}><option value="">Choose a member</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profile?.full_name || "Workspace member"}</option>)}</Select></label>;
  }
  return <label className="space-y-2 text-sm text-[#667878]"><span className="block font-medium text-ink">{label}</span><Input name={`cell_${column.id}`} defaultValue={typeof defaultValue === "string" ? defaultValue : ""} aria-label={label} /></label>;
}

export function TableRowForm({ workspaceId, tableId, columns, members, row, submitLabel = "Save row" }: { workspaceId: string; tableId: string; columns: TableColumn[]; members: Member[]; row?: TableRow | null; submitLabel?: string; }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTableRowAction, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="rowId" value={row?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        {columns.map((column) => <TableCellField key={column.id} column={column} members={members} defaultValue={row?.cell_values[column.id]} />)}
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

export function TableRowCommentForm({ workspaceId, tableId, rowId }: { workspaceId: string; tableId: string; rowId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addTableRowCommentAction, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="rowId" value={rowId} />
      <Textarea name="body" placeholder="Add a comment" aria-label="Row comment" />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>Add comment</SubmitButton>
    </form>
  );
}

export function TableRowCard({
  workspaceId,
  tableId,
  row,
  columns,
  visibleColumns,
  comments,
  members,
  memberLookup,
  canEdit,
  canManage,
}: {
  workspaceId: string;
  tableId: string;
  row: TableRow;
  columns: TableColumn[];
  visibleColumns: TableColumn[];
  comments: TableRowComment[];
  members: Member[];
  memberLookup: Record<string, string>;
  canEdit: boolean;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [deleteState, deleteAction] = useActionState<ActionState, FormData>(deleteTableRowAction, {});
  const [restoreState, restoreAction] = useActionState<ActionState, FormData>(restoreTableRowAction, {});
  const primaryColumn = visibleColumns[0] ?? columns[0];

  return (
    <Card className="border-[var(--line)] bg-white">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8a9992]">
              {visibleColumns.slice(0, 3).map((column) => <span key={column.id} className="rounded-full bg-sand px-2 py-1">{column.name}</span>)}
            </div>
            <h3 className={`mt-2 font-display text-xl font-semibold ${row.deleted_at ? "text-[#8a9992] line-through decoration-coral/60" : "text-ink"}`}>{formatTableCellValue(primaryColumn, row.cell_values[primaryColumn.id], memberLookup)}</h3>
            <p className="mt-1 text-xs text-[#8a9992]">Updated {new Date(row.updated_at).toLocaleString()}</p>
            {row.deleted_at && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-coral">Recycle bin item</p>}
          </div>
          {canEdit && !row.deleted_at && <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => setExpanded((current) => !current)}>{expanded ? "Collapse" : "Edit row"}</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {visibleColumns.map((column) => (
            <div key={column.id} className="rounded-xl border border-[var(--line)] bg-sand/20 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a9992]">{column.name}</dt>
              <dd className="mt-1 text-sm text-ink">{formatTableCellValue(column, row.cell_values[column.id], memberLookup)}</dd>
            </div>
          ))}
        </dl>
        {expanded && canEdit && !row.deleted_at && <TableRowForm workspaceId={workspaceId} tableId={tableId} columns={columns} members={members} row={row} submitLabel="Save changes" />}
        {canEdit && !row.deleted_at && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={deleteAction}>
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="tableId" value={tableId} />
              <input type="hidden" name="rowId" value={row.id} />
              <Button type="submit" variant="ghost" className="min-h-9 px-3 text-xs text-coral"><Trash2 size={14} className="mr-1" />Delete row</Button>
            </form>
          </div>
        )}
        {canManage && row.deleted_at && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={restoreAction}>
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="tableId" value={tableId} />
              <input type="hidden" name="rowId" value={row.id} />
              <Button type="submit" variant="secondary" className="min-h-9 px-3 text-xs"><Undo2 size={14} className="mr-1" />Restore row</Button>
            </form>
          </div>
        )}
        <FormMessage error={deleteState.error ?? restoreState.error} message={deleteState.message ?? restoreState.message} />
        {comments.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-sand/30 p-3 text-sm text-[#667878]">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-white p-3">
                <div className="text-xs font-semibold text-ink">{comment.author?.full_name || memberLookup[comment.author_id] || "Workspace member"}</div>
                <p className="mt-1 whitespace-pre-wrap leading-6">{comment.body}</p>
              </div>
            ))}
          </div>
        )}
        {canEdit && <Button type="button" variant="ghost" className="px-0 text-xs text-moss" onClick={() => setCommentOpen((current) => !current)}>{commentOpen ? "Hide comment form" : "Add comment"}</Button>}
        {commentOpen && canEdit && <TableRowCommentForm workspaceId={workspaceId} tableId={tableId} rowId={row.id} />}
      </CardContent>
    </Card>
  );
}

export function TableViewForm({ workspaceId, tableId, columns, view }: { workspaceId: string; tableId: string; columns: TableColumn[]; view?: TableView | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTableViewAction, {});
  const [filterColumnId, setFilterColumnId] = useState(view?.filter_rules?.[0]?.column_id ?? "");
  const [sortColumnId, setSortColumnId] = useState(view?.sort_rules?.[0]?.column_id ?? "");

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="tableId" value={tableId} />
      <input type="hidden" name="viewId" value={view?.id ?? ""} />
      {columns.map((column) => <input key={column.id} type="hidden" name="columnOrder" value={column.id} />)}
      <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
        <Input name="name" defaultValue={view?.name ?? ""} placeholder="View name" aria-label="View name" required />
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="isDefault" defaultChecked={view?.is_default ?? false} className="h-4 w-4 accent-[#3b6b58]" />Default view</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[#667878]">
          <span className="block font-medium text-ink">Filter column</span>
          <Select name="filterColumnId" value={filterColumnId} onChange={(event) => setFilterColumnId(event.target.value)}>
            <option value="">No filter</option>
            {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
          </Select>
        </label>
        <label className="space-y-2 text-sm text-[#667878]">
          <span className="block font-medium text-ink">Sort column</span>
          <Select name="sortColumnId" value={sortColumnId} onChange={(event) => setSortColumnId(event.target.value)}>
            <option value="">No sort</option>
            {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
          </Select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[#667878]">
          <span className="block font-medium text-ink">Filter operator</span>
          <Select name="filterOperator" defaultValue={view?.filter_rules?.[0]?.operator ?? "contains"}>
            {TABLE_FILTER_OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
          </Select>
        </label>
        <label className="space-y-2 text-sm text-[#667878]">
          <span className="block font-medium text-ink">Filter value</span>
          <Input name="filterValue" defaultValue={typeof view?.filter_rules?.[0]?.value === "string" ? view?.filter_rules?.[0]?.value : ""} placeholder="Enter a filter value" />
        </label>
      </div>
      <label className="space-y-2 text-sm text-[#667878]">
        <span className="block font-medium text-ink">Sort direction</span>
        <Select name="sortDirection" defaultValue={view?.sort_rules?.[0]?.direction ?? "asc"}>
          {TABLE_SORT_DIRECTIONS.map((direction) => <option key={direction.value} value={direction.value}>{direction.label}</option>)}
        </Select>
      </label>
      <details className="rounded-xl border border-[var(--line)] bg-sand/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Hidden columns</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {columns.map((column) => <label key={column.id} className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="hiddenColumnIds" value={column.id} defaultChecked={view?.hidden_column_ids.includes(column.id) ?? column.is_hidden} className="h-4 w-4 accent-[#3b6b58]" />{column.name}</label>)}
        </div>
      </details>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>Save view</SubmitButton>
    </form>
  );
}

export function CsvImportPanel({ workspaceId, tableId, columns }: { workspaceId: string; tableId: string; columns: TableColumn[] }) {
  const [state, action] = useActionState<ActionState, FormData>(importTableCsvAction, {});
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState("skip");
  const [keyColumnId, setKeyColumnId] = useState("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setHeaders([]);
      setRows([]);
      return;
    }
    const text = await file.text();
    const parsed = parseCsvText(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
  }

  const mappings = useMemo(() => mapCsvHeadersToColumns(headers, columns), [headers, columns]);
  const previewRows = useMemo(() => parseCsvPreviewRows(headers, rows), [headers, rows]);

  return (
    <Card className="border-[var(--line)] bg-sand/20">
      <CardHeader>
        <div>
          <p className="eyebrow">CSV import</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Bring in a small CSV</h3>
          <p className="mt-1 text-sm text-[#667878]">Map CSV columns to table columns, preview the first rows, and keep imports bounded.</p>
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="tableId" value={tableId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-[#667878]">
              <span className="block font-medium text-ink">CSV file</span>
              <Input type="file" name="csvFile" accept=".csv,text/csv,text/plain" onChange={(event) => void handleFileChange(event)} />
            </label>
            <label className="space-y-2 text-sm text-[#667878]">
              <span className="block font-medium text-ink">Duplicate strategy</span>
              <Select name="duplicateStrategy" value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value)}>
                <option value="skip">Skip duplicates</option>
                <option value="replace">Replace duplicates</option>
                <option value="error">Error on duplicates</option>
                <option value="append">Append all rows</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm text-[#667878]">
              <span className="block font-medium text-ink">Duplicate key column</span>
              <Select name="keyColumnId" value={keyColumnId} onChange={(event) => setKeyColumnId(event.target.value)}>
                <option value="">No duplicate key</option>
                {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
              </Select>
            </label>
          </div>
          {headers.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                {headers.map((header, index) => (
                  <label key={`${header}-${index}`} className="space-y-2 text-sm text-[#667878]">
                    <span className="block font-medium text-ink">{header}</span>
                    <Select name={`mapping_${index}`} defaultValue={mappings[index] ?? ""}>
                      <option value="">Skip column</option>
                      {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
              <div className="rounded-xl bg-sand/40 p-3 text-xs text-[#667878]">
                {previewRows.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-ink">Preview</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr>{headers.map((header) => <th key={header} className="border-b border-[var(--line)] pb-2 pr-3 font-semibold text-ink">{header}</th>)}</tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-[var(--line)]/60 last:border-0">
                              {headers.map((header) => <td key={`${header}-${rowIndex}`} className="py-2 pr-3">{row[header] || "—"}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p>The file is ready to preview once rows are detected.</p>
                )}
              </div>
            </div>
          )}
          <FormMessage error={state.error} message={state.message} />
          <SubmitButton>Import CSV</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
