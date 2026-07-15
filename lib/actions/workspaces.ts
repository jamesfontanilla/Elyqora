"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { requireUser, requireWorkspacePermission } from "@/lib/auth/guards";
import { WORKSPACE_COOKIE } from "@/lib/workspaces/current";
import { createClient } from "@/lib/supabase/server";

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters.").max(80, "Workspace name is too long."),
  type: z.enum(["personal", "team", "nonprofit", "education", "operations"]),
});

export async function createWorkspaceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = workspaceSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the workspace details." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_workspace_for_current_user", {
      p_workspace_name: parsed.data.name,
      p_workspace_type: parsed.data.type,
    });
    if (error) return { error: error.message };
    const workspace = Array.isArray(data) ? data[0] : data;
    if (workspace?.id) {
      const cookieStore = await cookies();
      cookieStore.set(WORKSPACE_COOKIE, workspace.id, { httpOnly: true, sameSite: "lax", path: "/" });
    }
    revalidatePath("/", "layout");
    redirect("/hub");
  } catch (error) {
    return actionError(error);
  }
  return { error: "We could not create the workspace." };
}

export async function switchWorkspaceAction(formData: FormData) {
  const workspaceId = z.string().uuid().safeParse(formData.get("workspaceId"));
  if (!workspaceId.success) return;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("id").eq("workspace_id", workspaceId.data).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!data) return;
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId.data, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
  redirect("/hub");
}

export async function renameWorkspaceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = z.string().uuid().safeParse(formData.get("workspaceId"));
  const name = z.string().trim().min(2).max(80).safeParse(formData.get("name"));
  if (!workspaceId.success || !name.success) return { error: "Enter a workspace name between 2 and 80 characters." };

  try {
    await requireWorkspacePermission(workspaceId.data, "workspace.update");
    const supabase = await createClient();
    const { error } = await supabase.from("workspaces").update({ name: name.data }).eq("id", workspaceId.data);
    if (error) return { error: error.message };
    await supabase.rpc("record_audit_event", { target_workspace_id: workspaceId.data, event_action: "workspace.renamed", event_entity_type: "workspace", event_entity_id: workspaceId.data, event_metadata: { name: name.data } });
    revalidatePath("/hub");
    revalidatePath("/settings/workspace");
    return { message: "Workspace name updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteWorkspaceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = z.string().uuid().safeParse(formData.get("workspaceId"));
  const confirmation = z.string().trim().safeParse(formData.get("confirmation"));
  const workspaceName = z.string().trim().min(1).safeParse(formData.get("workspaceName"));
  if (!workspaceId.success || !confirmation.success || !workspaceName.success || confirmation.data !== workspaceName.data) {
    return { error: "Type the workspace name exactly to confirm deletion." };
  }

  try {
    await requireWorkspacePermission(workspaceId.data, "workspace.delete");
    const supabase = await createClient();
    const { error } = await supabase.rpc("soft_delete_workspace", { target_workspace_id: workspaceId.data });
    if (error) return { error: error.message };
    const cookieStore = await cookies();
    cookieStore.delete(WORKSPACE_COOKIE);
    revalidatePath("/", "layout");
    redirect("/onboarding");
  } catch (error) {
    return actionError(error);
  }
  return { error: "We could not delete the workspace." };
}

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = z.string().trim().min(2, "Name must be at least 2 characters.").max(80).safeParse(formData.get("fullName"));
  const timezone = z.string().trim().min(1).max(80).safeParse(formData.get("timezone"));
  if (!fullName.success || !timezone.success) return { error: "Check your profile details." };

  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName.data, timezone: timezone.data }).eq("id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    revalidatePath("/settings/profile");
    return { message: "Profile updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createInvitationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = z.string().uuid().safeParse(formData.get("workspaceId"));
  const emailValue = String(formData.get("email") ?? "").trim();
  const email = emailValue ? z.string().email().safeParse(emailValue) : { success: true as const, data: undefined };
  const role = z.enum(["admin", "member", "viewer"]).safeParse(formData.get("role"));
  if (!workspaceId.success || !email.success || !role.success) return { error: "Enter a valid email and role." };

  try {
    const { user } = await requireWorkspacePermission(workspaceId.data, "members.manage");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const supabase = await createClient();
    const { data: roleRow } = await supabase.from("roles").select("id").eq("name", role.data).single();
    if (!roleRow) return { error: "That role is not available." };
    const { error } = await supabase.from("workspace_invitations").insert({ workspace_id: workspaceId.data, email: email.data ?? null, token_hash: tokenHash, token_preview: `${token.slice(0, 6)}…${token.slice(-4)}`, role_id: roleRow.id, invited_by: user.id, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    if (error) return { error: error.message };
    revalidatePath("/settings/members");
    return { message: "Invitation link created.", inviteUrl: `/invite/${token}` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateMemberRoleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const membershipId = z.string().uuid().safeParse(formData.get("membershipId"));
  const role = z.enum(["admin", "member", "viewer"]).safeParse(formData.get("role"));
  if (!membershipId.success || !role.success) return { error: "Select a valid role." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_membership_role", { target_membership_id: membershipId.data, next_role_name: role.data });
    if (error) return { error: error.message };
    revalidatePath("/settings/members");
    return { message: "Member role updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeMemberAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const membershipId = z.string().uuid().safeParse(formData.get("membershipId"));
  if (!membershipId.success) return { error: "Select a valid member." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_workspace_member", { target_membership_id: membershipId.data });
    if (error) return { error: error.message };
    revalidatePath("/settings/members");
    return { message: "Member removed from the workspace." };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeInvitationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const invitationId = z.string().uuid().safeParse(formData.get("invitationId"));
  const workspaceId = z.string().uuid().safeParse(formData.get("workspaceId"));
  if (!invitationId.success || !workspaceId.success) return { error: "Select a valid invitation." };
  try {
    await requireWorkspacePermission(workspaceId.data, "members.manage");
    const supabase = await createClient();
    const { error } = await supabase.from("workspace_invitations").update({ status: "revoked" }).eq("id", invitationId.data).eq("workspace_id", workspaceId.data);
    if (error) return { error: error.message };
    revalidatePath("/settings/members");
    return { message: "Invitation revoked." };
  } catch (error) {
    return actionError(error);
  }
}

export async function acceptInvitationAction(token: string) {
  const parsed = z.string().regex(/^[a-f0-9]{64}$/).safeParse(token);
  if (!parsed.success) return { error: "This invitation link is not valid." };
  const user = await requireUser();
  const tokenHash = createHash("sha256").update(parsed.data).digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_workspace_invitation", { token_hash_input: tokenHash });
  if (error) return { error: error.message };
  const workspace = Array.isArray(data) ? data[0] : data;
  if (workspace?.id) {
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspace.id, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  revalidatePath("/", "layout");
  void user;
  redirect("/hub?joined=1");
}
