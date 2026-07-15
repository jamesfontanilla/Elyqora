import type { ModuleDefinition } from "@/lib/types";

export const ELYQORA_MODULES: ModuleDefinition[] = [
  { name: "Hub", slug: "hub", icon: "⌂", description: "Your operating overview.", navigation: "primary", requiredPermission: "modules.read", enabled: true },
  { name: "Tasks", slug: "tasks", icon: "✓", description: "Plan and track focused work.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "Projects", slug: "projects", icon: "▣", description: "Coordinate outcomes and milestones.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "Notes", slug: "notes", icon: "✎", description: "Capture durable knowledge.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "Docs", slug: "docs", icon: "▤", description: "Keep important documents together.", navigation: "primary", requiredPermission: "docs.read", enabled: true },
  { name: "Calendar", slug: "calendar", icon: "◫", description: "Organize time without external providers.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "Contacts", slug: "contacts", icon: "♧", description: "Maintain people and relationship context.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "CRM", slug: "crm", icon: "◎", description: "Manage simple relationship pipelines.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "Forms", slug: "forms", icon: "☷", description: "Collect structured information.", navigation: "primary", requiredPermission: "modules.read", enabled: false },
  { name: "Tables", slug: "tables", icon: "▦", description: "Shape lightweight structured data.", navigation: "workspace", requiredPermission: "tables.read", enabled: true },
  { name: "Inventory", slug: "inventory", icon: "▥", description: "Know what is available.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Assets", slug: "assets", icon: "◆", description: "Track equipment and resources.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Requests", slug: "requests", icon: "↗", description: "Route internal requests.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Approvals", slug: "approvals", icon: "◉", description: "Make decisions visible.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Expenses", slug: "expenses", icon: "₱", description: "Keep lightweight expense records.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Budgets", slug: "budgets", icon: "∿", description: "See planned versus actual spend.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Time", slug: "time", icon: "◷", description: "Understand where time goes.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Help Desk", slug: "help-desk", icon: "?", description: "Give questions a clear home.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Knowledge", slug: "knowledge", icon: "⌘", description: "Share internal how-to knowledge.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Announcements", slug: "announcements", icon: "!", description: "Publish important updates.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Meetings", slug: "meetings", icon: "◌", description: "Turn meetings into accountable records.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Goals", slug: "goals", icon: "↗", description: "Connect effort to outcomes.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Reports", slug: "reports", icon: "▥", description: "Read operational summaries.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Dashboards", slug: "dashboards", icon: "▦", description: "Compose useful signals.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Files", slug: "files", icon: "◇", description: "Store small workspace files safely.", navigation: "workspace", requiredPermission: "drive.read", enabled: true },
  { name: "Comments", slug: "comments", icon: "◍", description: "Keep asynchronous discussions attached to work.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Automations", slug: "automations", icon: "✦", description: "Add retry-safe internal workflows.", navigation: "workspace", requiredPermission: "modules.read", enabled: false },
  { name: "Audit Log", slug: "audit-log", icon: "⌁", description: "Understand important workspace changes.", navigation: "settings", requiredPermission: "audit.read", enabled: false },
  { name: "Settings", slug: "settings", icon: "⚙", description: "Configure identity and workspace access.", navigation: "settings", requiredPermission: "workspace.read", enabled: true },
  { name: "Notifications", slug: "notifications", icon: "◔", description: "See in-app updates when they matter.", navigation: "settings", requiredPermission: "modules.read", enabled: false },
];

export const getModuleBySlug = (slug: string) => ELYQORA_MODULES.find((module) => module.slug === slug);

export const getEnabledModules = () => ELYQORA_MODULES.filter((module) => module.enabled);

export const getNavigationModules = (navigation: ModuleDefinition["navigation"]) =>
  ELYQORA_MODULES.filter((module) => module.navigation === navigation && module.enabled);

export const getMobileNavigationModules = () => [
  ...getNavigationModules("primary"),
  ...getNavigationModules("workspace"),
  ...getNavigationModules("settings"),
];

export function getModuleHref(module: ModuleDefinition) {
  return module.slug === "settings" ? "/settings/profile" : `/${module.slug}`;
}

export function getHubEmptyState(moduleSlug: "tasks" | "calendar" | "projects", count = 0) {
  if (count > 0) return null;
  const copy = {
    tasks: { title: "No assigned tasks", body: "The Tasks module is not configured yet." },
    calendar: { title: "No upcoming events", body: "The Calendar module is not configured yet." },
    projects: { title: "No active projects", body: "The Projects module is not configured yet." },
  } as const;
  return copy[moduleSlug];
}
