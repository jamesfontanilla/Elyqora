import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspaces } from "@/lib/auth/guards";
import type { Membership, Profile, Role, Workspace } from "@/lib/types";

export const WORKSPACE_COOKIE = "elyqora-workspace-id";

export type WorkspaceMember = Membership & {
  profile?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  role?: Pick<Role, "id" | "name" | "label"> | null;
};

export async function getCurrentWorkspace(userId: string): Promise<Workspace | null> {
  const workspaces = await getUserWorkspaces(userId);
  if (workspaces.length === 0) return null;

  const cookieStore = await cookies();
  const preferredId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  return workspaces.find((workspace) => workspace.id === preferredId) ?? workspaces[0] ?? null;
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("id,workspace_id,user_id,role_id,status,created_at,updated_at,profile:profiles(id,full_name,avatar_url),role:roles(id,name,label)")
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as WorkspaceMember[];
}

export async function getWorkspaceInvitations(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getWorkspaceAuditEvents(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(0, 49);
  return data ?? [];
}
