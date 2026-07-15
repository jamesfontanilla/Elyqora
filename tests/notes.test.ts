import { describe, expect, it } from "vitest";
import { ELYQORA_MODULES, getMobileNavigationModules } from "@/lib/modules/registry";
import { canEditNoteRecord, canManageNoteRecord, canReadNoteRecord } from "@/lib/notes/access";
import { emptyBody, emptyTitle } from "@/components/notes/library";
import { getNoteExcerpt, parseNoteLabels } from "@/lib/notes/constants";

describe("Notes authorization", () => {
  const baseNote = {
    workspaceId: "workspace-a",
    noteWorkspaceId: "workspace-a",
    noteScope: "workspace" as const,
    noteVisibility: "workspace" as const,
    membershipStatus: "active",
    createdBy: "user-a",
    userId: "user-a",
    canReadNotes: true,
    canWriteNotes: true,
    canManageNotes: false,
    isDeleted: false,
  };

  it("keeps notes isolated across workspaces", () => {
    expect(canReadNoteRecord({ ...baseNote, workspaceId: "workspace-b" })).toBe(false);
    expect(canReadNoteRecord({ ...baseNote, userId: "user-b", createdBy: "user-a", noteVisibility: "private" })).toBe(false);
  });

  it("lets creators edit their own personal notes but not deleted notes", () => {
    expect(canEditNoteRecord({ ...baseNote, noteScope: "personal", noteVisibility: "private" })).toBe(true);
    expect(canEditNoteRecord({ ...baseNote, noteScope: "personal", noteVisibility: "private", isDeleted: true })).toBe(false);
  });

  it("reserves note management for manage permissions on workspace notes", () => {
    expect(canManageNoteRecord({ ...baseNote, canManageNotes: false })).toBe(false);
    expect(canManageNoteRecord({ ...baseNote, canManageNotes: true })).toBe(true);
  });
});

describe("Notes registry and navigation", () => {
  it("registers Notes as an enabled primary module", () => {
    expect(ELYQORA_MODULES.find((module) => module.slug === "notes")).toMatchObject({
      enabled: true,
      requiredPermission: "notes.read",
      navigation: "primary",
    });
  });

  it("keeps disabled modules disabled while mobile navigation still includes Notes", () => {
    expect(ELYQORA_MODULES.find((module) => module.slug === "tasks")?.enabled).toBe(false);
    expect(getMobileNavigationModules().some((module) => module.slug === "notes")).toBe(true);
  });
});

describe("Notes empty states and preview helpers", () => {
  it("returns friendly empty-state copy for the trash and label views", () => {
    expect(emptyTitle("trash")).toBe("Trash is empty");
    expect(emptyBody("label")).toContain("another label");
  });

  it("normalizes labels and builds a short excerpt with checklist items", () => {
    expect(parseNoteLabels(" Launch, follow-up;Ideas \n")).toEqual(["launch", "follow-up", "ideas"]);
    expect(getNoteExcerpt("  # Heading\n\nBody text here ", [
      { id: "1", text: "Review setup", checked: true },
      { id: "2", text: "Archive the draft", checked: false },
    ])).toContain("[x] Review setup");
  });
});
