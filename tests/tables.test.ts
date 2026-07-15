import { describe, expect, it } from "vitest";
import { canEditTableRecord, canManageTableRecord, canReadTableRecord, isTableColumnType } from "@/lib/tables/access";
import { coerceTableCellValue, normalizeTableColumnKey, sanitizeTableName, TABLE_COLUMN_TYPES, validateTableColumnSettings } from "@/lib/tables/constants";
import { parseCsvText, serializeCsvRows } from "@/lib/tables/csv";
import { ELYQORA_MODULES, getModuleHref } from "@/lib/modules/registry";

const activeContext = {
  workspaceId: "workspace-a",
  tableWorkspaceId: "workspace-a",
  membershipStatus: "active" as const,
  canReadTables: true,
  canWriteTables: true,
  canManageTables: true,
};

describe("Tables authorization", () => {
  it("keeps tables isolated to the current workspace", () => {
    expect(canReadTableRecord(activeContext)).toBe(true);
    expect(canEditTableRecord(activeContext)).toBe(true);
    expect(canManageTableRecord(activeContext)).toBe(true);

    expect(canReadTableRecord({ ...activeContext, workspaceId: "workspace-b" })).toBe(false);
    expect(canEditTableRecord({ ...activeContext, workspaceId: "workspace-b" })).toBe(false);
    expect(canManageTableRecord({ ...activeContext, workspaceId: "workspace-b" })).toBe(false);
  });
});

describe("Tables column safety", () => {
  it("recognizes only supported column types", () => {
    for (const type of TABLE_COLUMN_TYPES.map((entry) => entry.value)) {
      expect(isTableColumnType(type)).toBe(true);
    }
    expect(isTableColumnType("formula")).toBe(false);
  });

  it("sanitizes names and column keys", () => {
    expect(sanitizeTableName("  Quarterly\u0000 tracker  ")).toBe("Quarterly tracker");
    expect(normalizeTableColumnKey("3 Priority!")).toBe("field_3_priority");
  });

  it("validates select and currency settings", () => {
    expect(validateTableColumnSettings("single_select", { options: ["Open", "Open", ""] })).toEqual({
      ok: true,
      settings: { options: ["Open"] },
    });
    expect(validateTableColumnSettings("currency", { precision: 9, currency_code: "usd" })).toEqual({
      ok: true,
      settings: { precision: 2, currency_code: "USD" },
    });
  });

  it("rejects unsafe cell values for URLs and multi-selects", () => {
    expect(coerceTableCellValue({ column_type: "url", settings: {} }, "javascript:alert(1)")).toMatchObject({ ok: false });
    expect(coerceTableCellValue({ column_type: "multi_select", settings: { options: ["A", "B"] } }, "A, C")).toMatchObject({ ok: false });
  });
});

describe("Tables CSV helpers", () => {
  it("round-trips a small CSV payload", () => {
    const source = 'Name,Status\n"Workspace launch","In progress"';
    const parsed = parseCsvText(source);
    expect(parsed.headers).toEqual(["Name", "Status"]);
    expect(parsed.rows).toEqual([["Workspace launch", "In progress"]]);

    const serialized = serializeCsvRows(parsed.headers, [{ Name: "Workspace launch", Status: "In progress" }]);
    expect(parseCsvText(serialized)).toEqual(parsed);
  });
});

describe("Tables registry", () => {
  it("registers Tables as an enabled workspace module", () => {
    const tables = ELYQORA_MODULES.find((module) => module.slug === "tables");
    expect(tables).toMatchObject({ enabled: true, requiredPermission: "tables.read" });
    expect(getModuleHref(tables!)).toBe("/tables");
  });
});
