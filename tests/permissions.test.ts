import { describe, expect, it } from "vitest";
import { canManageMembers, hasLocalPermission } from "@/lib/permissions";
import { ELYQORA_MODULES } from "@/lib/modules/registry";

describe("workspace permissions", () => {
  it("gives owners full workspace controls", () => {
    expect(hasLocalPermission("owner", "workspace.delete")).toBe(true);
    expect(hasLocalPermission("owner", "members.manage")).toBe(true);
    expect(canManageMembers("owner")).toBe(true);
  });

  it("keeps viewers read-only", () => {
    expect(hasLocalPermission("viewer", "modules.read")).toBe(true);
    expect(hasLocalPermission("viewer", "workspace.update")).toBe(false);
    expect(canManageMembers("viewer")).toBe(false);
  });
});

describe("module registry", () => {
  it("contains thirty stable module records", () => {
    expect(ELYQORA_MODULES).toHaveLength(30);
    expect(new Set(ELYQORA_MODULES.map((module) => module.slug)).size).toBe(30);
  });
});
