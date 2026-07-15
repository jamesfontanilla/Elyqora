import { describe, expect, it } from "vitest";
import {
  canEditDocument,
  canReadDocument,
  canRestoreDocumentVersion,
} from "@/lib/docs/access";
import { isSafeDocumentLink } from "@/lib/docs/constants";
import { ELYQORA_MODULES } from "@/lib/modules/registry";

const document = {
  id: "document-a",
  workspace_id: "workspace-a",
  created_by: "owner-a",
  status: "published" as const,
  visibility: "workspace" as const,
  deleted_at: null,
};

describe("Docs authorization", () => {
  it("keeps workspace-visible documents isolated from other workspaces", () => {
    expect(
      canReadDocument({
        userId: "member-a",
        workspaceId: "workspace-b",
        isWorkspaceMember: true,
        document,
      }),
    ).toBe(false);
  });

  it("allows a shared editor to edit but not a shared reader", () => {
    const base = {
      userId: "member-a",
      workspaceId: "workspace-a",
      isWorkspaceMember: true,
      document,
    };

    expect(canEditDocument({ ...base, sharePermission: "read" })).toBe(false);
    expect(canEditDocument({ ...base, sharePermission: "edit" })).toBe(true);
  });

  it("only restores a version through the same document edit authorization", () => {
    const base = {
      userId: "member-a",
      workspaceId: "workspace-a",
      isWorkspaceMember: true,
      document,
    };

    expect(
      canRestoreDocumentVersion({
        ...base,
        versionDocumentId: "document-a",
        sharePermission: "edit",
      }),
    ).toBe(true);
    expect(
      canRestoreDocumentVersion({
        ...base,
        versionDocumentId: "document-b",
        sharePermission: "edit",
      }),
    ).toBe(false);
  });
});

describe("Docs safety and registration", () => {
  it("allows only safe external or internal document links", () => {
    expect(isSafeDocumentLink("https://example.com/reference")).toBe(true);
    expect(isSafeDocumentLink("/docs/document-a")).toBe(true);
    expect(isSafeDocumentLink("javascript:alert(1)")).toBe(false);
  });

  it("registers Docs through the shared module registry", () => {
    expect(ELYQORA_MODULES.find((module) => module.slug === "docs")).toMatchObject({
      enabled: true,
      requiredPermission: "docs.read",
    });
  });
});
