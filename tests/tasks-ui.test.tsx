import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreateTaskForm, TaskCompleteForm } from "@/components/tasks/forms";

describe("Tasks UI", () => {
  it("renders the task creation form controls", () => {
    render(
      <CreateTaskForm
        workspaceId="workspace-a"
        members={[
          { user_id: "user-a", profile: { full_name: "Alex Morgan", avatar_url: null } },
        ]}
      />,
    );

    expect(screen.getByLabelText("Task title")).toBeInTheDocument();
    expect(screen.getByLabelText("Task scope")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create task/i })).toBeInTheDocument();
  });

  it("renders the task completion action", () => {
    render(<TaskCompleteForm taskId="task-a" />);

    expect(screen.getByRole("button", { name: /complete task/i })).toBeInTheDocument();
  });
});
