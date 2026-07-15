import type { TableColumn, TableColumnSettings, TableColumnType, TableFilterOperator, TableSortDirection } from "@/lib/types";

export const TABLE_PAGE_SIZE = 25;
export const TABLE_OVERVIEW_PAGE_SIZE = 12;
export const TABLE_ROW_WINDOW = 200;
export const TABLE_IMPORT_ROW_LIMIT = 200;
export const TABLE_IMPORT_FILE_SIZE_LIMIT_BYTES = 1024 * 1024;
export const TABLE_EXPORT_ROW_LIMIT = 500;
export const TABLE_MAX_COLUMNS = 24;
export const TABLE_MAX_NAME_LENGTH = 120;
export const TABLE_MAX_DESCRIPTION_LENGTH = 240;
export const TABLE_MAX_COLUMN_NAME_LENGTH = 80;
export const TABLE_MAX_COMMENT_LENGTH = 4000;
export const TABLE_MAX_LONG_TEXT_LENGTH = 10000;

export const TABLE_COLUMN_TYPES: Array<{ value: TableColumnType; label: string; description: string }> = [
  { value: "text", label: "Text", description: "Short text values." },
  { value: "long_text", label: "Long text", description: "Notes and longer copy." },
  { value: "number", label: "Number", description: "Plain numeric values." },
  { value: "currency", label: "Currency", description: "Monetary values with a code." },
  { value: "boolean", label: "Boolean", description: "Yes or no values." },
  { value: "date", label: "Date", description: "Calendar dates in YYYY-MM-DD format." },
  { value: "single_select", label: "Single select", description: "Choose one option." },
  { value: "multi_select", label: "Multi-select", description: "Choose many options." },
  { value: "url", label: "URL", description: "Safe web links." },
  { value: "user_reference", label: "User reference", description: "A workspace member." },
];

export const TABLE_FILTER_OPERATORS: Array<{ value: TableFilterOperator; label: string }> = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "is_empty", label: "Is empty" },
  { value: "not_empty", label: "Is not empty" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

export const TABLE_SORT_DIRECTIONS: Array<{ value: TableSortDirection; label: string }> = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

export function sanitizeTableName(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, TABLE_MAX_NAME_LENGTH) || "Untitled table";
}

export function sanitizeTableDescription(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, TABLE_MAX_DESCRIPTION_LENGTH);
}

export function sanitizeTableColumnName(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, TABLE_MAX_COLUMN_NAME_LENGTH) || "Untitled column";
}

export function normalizeTableColumnKey(value: string) {
  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64);
  return /^[a-z]/.test(key) ? key : `field_${key || "value"}`;
}

export function uniqueTableColumnKey(name: string, existingKeys: Iterable<string>) {
  const taken = new Set(existingKeys);
  const base = normalizeTableColumnKey(name);
  if (!taken.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const next = `${base}_${index}`;
    if (!taken.has(next)) return next;
  }
  return `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getTableColumnTypeLabel(columnType: TableColumnType) {
  return TABLE_COLUMN_TYPES.find((type) => type.value === columnType)?.label ?? columnType;
}

export function getDefaultTableColumnSettings(columnType: TableColumnType): TableColumnSettings {
  if (columnType === "currency") return { currency_code: "USD", precision: 2 };
  if (columnType === "single_select" || columnType === "multi_select") return { options: [] };
  return {};
}

export function validateTableColumnSettings(columnType: TableColumnType, settings: TableColumnSettings) {
  if (columnType === "single_select" || columnType === "multi_select") {
    const options = Array.isArray(settings.options) ? [...new Set(settings.options.map((option) => option.trim()).filter(Boolean))].slice(0, 50) : [];
    if (options.length === 0) return { ok: false as const, error: "Select columns need at least one option." };
    return { ok: true as const, settings: { options } };
  }

  if (columnType === "currency") {
    const precision = typeof settings.precision === "number" && Number.isInteger(settings.precision) && settings.precision >= 0 && settings.precision <= 6 ? settings.precision : 2;
    const currencyCode = typeof settings.currency_code === "string" && /^[A-Z]{3}$/.test(settings.currency_code) ? settings.currency_code : "USD";
    return { ok: true as const, settings: { precision, currency_code: currencyCode } };
  }

  return { ok: true as const, settings: {} };
}

export function coerceTableCellValue(column: Pick<TableColumn, "column_type" | "settings">, raw: string | null) {
  const value = raw?.trim() ?? "";
  if (!value) return { ok: true as const, value: null };

  if (column.column_type === "text" || column.column_type === "long_text") {
    return { ok: true as const, value: value.slice(0, column.column_type === "text" ? 240 : TABLE_MAX_LONG_TEXT_LENGTH) };
  }
  if (column.column_type === "url") {
    if (!/^https?:\/\/[^\s]+$/i.test(value)) return { ok: false as const, error: "Enter a safe http or https URL." };
    return { ok: true as const, value };
  }
  if (column.column_type === "number" || column.column_type === "currency") {
    const numeric = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return { ok: false as const, error: "Enter a valid number." };
    return { ok: true as const, value: numeric };
  }
  if (column.column_type === "boolean") {
    if (value !== "true" && value !== "false") return { ok: false as const, error: "Choose yes or no." };
    return { ok: true as const, value: value === "true" };
  }
  if (column.column_type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false as const, error: "Use YYYY-MM-DD." };
    return { ok: true as const, value };
  }
  if (column.column_type === "single_select") {
    const options = Array.isArray(column.settings.options) ? column.settings.options : [];
    if (!options.includes(value)) return { ok: false as const, error: "Choose a valid option." };
    return { ok: true as const, value };
  }
  if (column.column_type === "multi_select") {
    const options = Array.isArray(column.settings.options) ? column.settings.options : [];
    const values = value.split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean);
    const invalid = values.find((entry) => !options.includes(entry));
    if (invalid) return { ok: false as const, error: "One or more selected options are invalid." };
    return { ok: true as const, value: [...new Set(values)].slice(0, 20) };
  }
  if (column.column_type === "user_reference") {
    if (!/^[0-9a-f-]{36}$/i.test(value)) return { ok: false as const, error: "Choose a valid workspace member." };
    return { ok: true as const, value };
  }
  return { ok: false as const, error: "Unsupported column type." };
}

export function formatTableCellValue(column: Pick<TableColumn, "column_type" | "settings">, value: unknown, memberLookup?: Record<string, string | null | undefined>) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.column_type === "currency" && typeof value === "number") {
    const precision = typeof column.settings.precision === "number" ? column.settings.precision : 2;
    const currencyCode = typeof column.settings.currency_code === "string" ? column.settings.currency_code : "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value);
  }
  if (column.column_type === "number" && typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  if (column.column_type === "boolean" && typeof value === "boolean") return value ? "Yes" : "No";
  if (column.column_type === "date" && typeof value === "string") return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  if (column.column_type === "multi_select" && Array.isArray(value)) return value.join(", ");
  if (column.column_type === "user_reference" && typeof value === "string") return memberLookup?.[value] || value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function getTableValueSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((entry) => getTableValueSearchText(entry)).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map((entry) => getTableValueSearchText(entry)).join(" ");
  return String(value);
}
