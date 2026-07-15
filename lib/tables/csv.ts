import type { TableColumn } from "@/lib/types";
import { getTableValueSearchText, sanitizeTableColumnName } from "@/lib/tables/constants";

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export function parseCsvText(input: string): CsvParseResult {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }
    if (character === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }
    currentValue += character;
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  const nonEmptyRows = rows.filter((row, rowIndex) => row.some((cell) => cell.trim().length > 0) || rowIndex === 0);
  const headers = nonEmptyRows.shift() ?? [];
  return { headers, rows: nonEmptyRows };
}

export function escapeCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeCsvRows(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(getTableValueSearchText(row[header]))).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function normalizeCsvHeader(value: string) {
  return sanitizeTableColumnName(value).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function mapCsvHeadersToColumns(headers: string[], columns: TableColumn[]) {
  const normalizedColumns = new Map(columns.map((column) => [normalizeCsvHeader(column.name), column.id]));
  const normalizedKeys = new Map(columns.map((column) => [normalizeCsvHeader(column.column_key), column.id]));
  return headers.map((header) => normalizedColumns.get(normalizeCsvHeader(header)) ?? normalizedKeys.get(normalizeCsvHeader(header)) ?? "");
}

export function parseCsvPreviewRows(headers: string[], rows: string[][], previewRowCount = 5) {
  return rows.slice(0, previewRowCount).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}
