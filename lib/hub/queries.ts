import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getProfile } from "@/lib/auth/guards";
import { getEnabledModules } from "@/lib/modules/registry";
import type { DashboardPreferences, NotificationItem, PinnedModule, RecentItem, Workspace } from "@/lib/types";

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  workspace_id: "",
  user_id: "",
  quick_actions: ["workspace-settings", "members", "profile"],
  layout: { columns: "balanced", show_recent: true, show_notifications: true },
  show_recent: true,
  show_notifications: true,
};

export interface HubData {
  workspace: Workspace;
  profile: Awaited<ReturnType<typeof getProfile>>;
  membersCount: number;
  recentItems: RecentItem[];
  pinnedModules: PinnedModule[];
  notifications: NotificationItem[];
  preferences: DashboardPreferences;
  enabledModules: ReturnType<typeof getEnabledModules>;
  assignedTasks: never[];
  upcomingEvents: never[];
  activeProjects: never[];
}

export async function getHubData(userId: string): Promise<HubData | null> {
  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) return null;

  const supabase = await createClient();
  const [profile, members, recent, pinned, notifications, preferences] = await Promise.all([
    getProfile(userId),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active"),
    supabase.from("recent_items").select("*").eq("workspace_id", workspace.id).eq("user_id", userId).order("last_opened_at", { ascending: false }).range(0, 7),
    supabase.from("pinned_modules").select("id,workspace_id,user_id,module_slug,position").eq("workspace_id", workspace.id).eq("user_id", userId).order("position", { ascending: true }).range(0, 11),
    supabase.from("notifications").select("*").eq("workspace_id", workspace.id).eq("user_id", userId).order("created_at", { ascending: false }).range(0, 5),
    supabase.from("dashboard_preferences").select("*").eq("workspace_id", workspace.id).eq("user_id", userId).maybeSingle(),
  ]);

  const preferenceData = preferences.data as DashboardPreferences | null;
  const safePreferences: DashboardPreferences = preferenceData
    ? { ...DEFAULT_DASHBOARD_PREFERENCES, ...preferenceData }
    : { ...DEFAULT_DASHBOARD_PREFERENCES, workspace_id: workspace.id, user_id: userId };

  return {
    workspace,
    profile,
    membersCount: members.count ?? 0,
    recentItems: (recent.data ?? []) as RecentItem[],
    pinnedModules: (pinned.data ?? []) as PinnedModule[],
    notifications: (notifications.data ?? []) as NotificationItem[],
    preferences: safePreferences,
    enabledModules: getEnabledModules(),
    // These module tables intentionally do not exist until their modules are implemented.
    // Keeping the summary arrays bounded and local lets Hub stay useful without cross-module joins.
    assignedTasks: [],
    upcomingEvents: [],
    activeProjects: [],
  };
}
