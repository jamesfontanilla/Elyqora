"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/actions/types";
import { requireUser } from "@/lib/auth/guards";
import { getModuleBySlug } from "@/lib/modules/registry";
import { createClient } from "@/lib/supabase/server";

const recentItemSchema = z.object({
  workspaceId: z.string().uuid(),
  entityType: z.string().trim().min(1).max(40),
  entityId: z.string().uuid(),
  label: z.string().trim().min(1).max(160),
  href: z.string().regex(/^\//),
  icon: z.string().trim().min(1).max(8),
});

export async function recordRecentItemAction(input: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  label: string;
  href: string;
  icon: string;
}) {
  const parsed = recentItemSchema.safeParse(input);
  if (!parsed.success) return;

  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: existing } = await supabase.from("recent_items").select("id,open_count").match({ workspace_id: parsed.data.workspaceId, user_id: user.id, entity_type: parsed.data.entityType, entity_id: parsed.data.entityId }).maybeSingle();
    const { error } = await supabase.from("recent_items").upsert({
      ...parsed.data,
      workspace_id: parsed.data.workspaceId,
      user_id: user.id,
      open_count: (existing?.open_count ?? 0) + 1,
      last_opened_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,user_id,entity_type,entity_id" });
    if (error) return;
    revalidatePath("/hub");
  } catch {
    // Recent-item tracking is helpful, not a reason to block navigation.
  }
}

export async function togglePinnedModuleAction(input: { workspaceId: string; moduleSlug: string; pinned: boolean }) {
  const parsed = z.object({ workspaceId: z.string().uuid(), moduleSlug: z.string().min(1), pinned: z.boolean() }).safeParse(input);
  if (!parsed.success) return;
  const moduleDefinition = getModuleBySlug(parsed.data.moduleSlug);
  if (!moduleDefinition?.enabled) return;

  try {
    const user = await requireUser();
    const supabase = await createClient();
    if (parsed.data.pinned) {
      const { count } = await supabase.from("pinned_modules").select("id", { count: "exact", head: true }).eq("workspace_id", parsed.data.workspaceId).eq("user_id", user.id);
      await supabase.from("pinned_modules").upsert({ workspace_id: parsed.data.workspaceId, user_id: user.id, module_slug: moduleDefinition.slug, position: count ?? 0 }, { onConflict: "workspace_id,user_id,module_slug" });
    } else {
      await supabase.from("pinned_modules").delete().eq("workspace_id", parsed.data.workspaceId).eq("user_id", user.id).eq("module_slug", moduleDefinition.slug);
    }
    revalidatePath("/hub");
  } catch {
    // The launcher can remain usable if an optional preference write fails.
  }
}

export async function saveDashboardPreferencesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const workspaceId = z.string().uuid().safeParse(formData.get("workspaceId"));
  const quickActions = formData.getAll("quickActions").map(String);
  const allowed = new Set(["workspace-settings", "members", "profile", "modules"]);
  if (!workspaceId.success || quickActions.some((action) => !allowed.has(action))) return { error: "Choose valid quick actions." };

  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("dashboard_preferences").upsert({
      workspace_id: workspaceId.data,
      user_id: user.id,
      quick_actions: quickActions,
      show_recent: formData.get("showRecent") === "on",
      show_notifications: formData.get("showNotifications") === "on",
      layout: { columns: "balanced", show_recent: formData.get("showRecent") === "on", show_notifications: formData.get("showNotifications") === "on" },
    }, { onConflict: "workspace_id,user_id" });
    if (error) return { error: error.message };
    revalidatePath("/hub");
    return { message: "Hub preferences saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function markNotificationReadAction(notificationId: string) {
  const parsed = z.string().uuid().safeParse(notificationId);
  if (!parsed.success) return;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data).eq("user_id", user.id);
    revalidatePath("/hub");
  } catch {
    // Read state is non-critical.
  }
}
