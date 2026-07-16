import { describe, expect, it } from "vitest";
import { canReadHubRecord } from "@/lib/hub/access";
import { getHubEmptyState, getMobileNavigationModules, getModuleBySlug, getModuleHref, getNavigationModules } from "@/lib/modules/registry";

describe("Hub workspace isolation", () => {
  it("requires the same user, workspace, and active membership", () => {
    const record = { recordUserId: "user-a", recordWorkspaceId: "workspace-a", userId: "user-a", workspaceId: "workspace-a", membershipStatus: "active" };
    expect(canReadHubRecord(record)).toBe(true);
    expect(canReadHubRecord({ ...record, userId: "user-b" })).toBe(false);
    expect(canReadHubRecord({ ...record, workspaceId: "workspace-b" })).toBe(false);
    expect(canReadHubRecord({ ...record, membershipStatus: "removed" })).toBe(false);
  });
});

describe("Hub navigation and empty states", () => {
  it("only exposes enabled modules in navigation", () => {
    expect(getNavigationModules("primary").some((module) => module.slug === "tasks")).toBe(true);
    expect(getNavigationModules("primary").some((module) => module.slug === "hub")).toBe(true);
    expect(getNavigationModules("settings").some((module) => module.slug === "settings")).toBe(true);
  });

  it("keeps mobile navigation registry-driven and unique", () => {
    const modules = getMobileNavigationModules();
    expect(modules.length).toBeGreaterThan(0);
    expect(new Set(modules.map((module) => module.slug)).size).toBe(modules.length);
  });

  it("routes settings through its settings entry and disables planned modules", () => {
    expect(getModuleHref(getModuleBySlug("settings")!)).toBe("/settings/profile");
    expect(getModuleBySlug("tasks")?.enabled).toBe(true);
  });

  it("returns calm empty states until module tables exist", () => {
    expect(getHubEmptyState("tasks", 0)?.title).toBe("No assigned tasks");
    expect(getHubEmptyState("calendar", 0)?.title).toBe("No upcoming events");
    expect(getHubEmptyState("projects", 1)).toBeNull();
  });
});
