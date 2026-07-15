import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Membership, PermissionKey, Profile, Role, Workspace } from "@/lib/types";

export async function getCurrentUser(): Promise<User | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function hasPermission(workspaceId: string, permission: PermissionKey) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_workspace_permission", {
    target_workspace_id: workspaceId,
    required_permission: permission,
  });
  return !error && Boolean(data);
}

export async function getMembership(workspaceId: string, userId: string): Promise<(Membership & { role: Role }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("*, role:roles(id,name,label,description)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as (Membership & { role: Role }) | null) ?? null;
}

export async function requireWorkspacePermission(workspaceId: string, permission: PermissionKey) {
  const user = await requireUser();
  const membership = await getMembership(workspaceId, user.id);
  if (!membership || !(await hasPermission(workspaceId, permission))) {
    throw new Error("You do not have permission to perform this action");
  }
  return { user, membership };
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("workspace:workspaces!inner(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("workspace.deleted_at", null)
    .order("created_at", { referencedTable: "workspace", ascending: true });

  return ((data ?? []) as unknown as Array<{ workspace: Workspace | Workspace[] | null }>)
    .flatMap((item) => Array.isArray(item.workspace) ? item.workspace : item.workspace ? [item.workspace] : []);
}
