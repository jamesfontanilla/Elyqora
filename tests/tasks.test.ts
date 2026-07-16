import { describe, expect, it } from "vitest";
import { ELYQORA_MODULES } from "@/lib/modules/registry";
import { canEditTaskRecord, canManageTaskRecord, canReadTaskRecord } from "@/lib/tasks/access";
import { calculateNextTaskOccurrence, normalizeTaskRecurrenceRule } from "@/lib/tasks/recurrence";
import { emptyBody, emptyTitle, TASK_NAV } from "@/components/tasks/library";

describe("Tasks recurrence helpers", () => {
  it("normalizes recurrence rules and strips invalid values", () => {
    expect(
      normalizeTaskRecurrenceRule({
        frequency: "weekly",
        interval: 0,
        weekdays: [1, 1, 3, 9],
        day_of_month: 40,
        end_date: "2026-13-01",
      }),
    ).toEqual({
      frequency: "weekly",
      interval: 1,
      weekdays: [1, 3],
      day_of_month: 40,
      end_date: null,
    });
  });

  it("calculates the next occurrence while preserving task duration", () => {
    const next = calculateNextTaskOccurrence({
      start_date: "2026-07-10",
      due_date: "2026-07-12",
      recurrence_rule: { frequency: "daily", interval: 1 },
    });

    expect(next).toEqual({
      start_date: "2026-07-11",
      due_date: "2026-07-13",
    });
  });
});

describe("Tasks authorization", () => {
  const base = {
    workspaceId: "workspace-a",
    taskWorkspaceId: "workspace-a",
    taskScope: "workspace" as const,
    taskStatus: "todo" as const,
    membershipStatus: "active",
    createdBy: "user-a",
    assigneeId: "user-a",
    userId: "user-a",
    canReadTasks: true,
    canWriteTasks: true,
    canManageTasks: false,
    isDeleted: false,
  };

  it("keeps workspace tasks isolated across workspaces", () => {
    expect(canReadTaskRecord({ ...base, workspaceId: "workspace-b" })).toBe(false);
    expect(canReadTaskRecord({ ...base, taskScope: "personal" })).toBe(true);
    expect(canReadTaskRecord({ ...base, taskScope: "personal", userId: "user-b" })).toBe(false);
  });

  it("allows owners to edit personal tasks but not other users' personal tasks", () => {
    expect(canEditTaskRecord({ ...base, taskScope: "personal", taskStatus: "todo", canWriteTasks: true, userId: "user-a" })).toBe(true);
    expect(canEditTaskRecord({ ...base, taskScope: "personal", taskStatus: "todo", canWriteTasks: true, userId: "user-b" })).toBe(false);
  });

  it("reserves destructive management for manage permission or ownership", () => {
    expect(canManageTaskRecord({ ...base, taskScope: "workspace", canManageTasks: false })).toBe(false);
    expect(canManageTaskRecord({ ...base, taskScope: "workspace", canManageTasks: true })).toBe(true);
  });
});

describe("Tasks registry and empty states", () => {
  it("registers Tasks as an enabled primary module", () => {
    expect(ELYQORA_MODULES.find((module) => module.slug === "tasks")).toMatchObject({
      enabled: true,
      requiredPermission: "tasks.read",
      navigation: "primary",
    });
  });

  it("keeps the task navigation and empty-state copy bounded", () => {
    expect(TASK_NAV).toHaveLength(6);
    expect(emptyTitle("overdue")).toBe("No overdue tasks");
    expect(emptyBody("mine")).toContain("assigned and self-owned");
  });
});
