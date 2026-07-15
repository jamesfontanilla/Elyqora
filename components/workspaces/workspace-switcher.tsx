"use client";

import { useRef } from "react";
import { switchWorkspaceAction } from "@/lib/actions/workspaces";
import type { Workspace } from "@/lib/types";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function WorkspaceSwitcher({ workspaces, currentWorkspace }: { workspaces: Workspace[]; currentWorkspace: Workspace }) {
  const formRef = useRef<HTMLFormElement>(null);
  return <form ref={formRef} action={switchWorkspaceAction} className="space-y-2"><Label className="px-1 text-xs uppercase tracking-[0.14em] text-[#8a9992]">Current workspace</Label><Select name="workspaceId" value={currentWorkspace.id} onChange={() => formRef.current?.requestSubmit()} aria-label="Switch workspace">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</Select></form>;
}
