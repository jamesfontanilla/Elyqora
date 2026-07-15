"use client";

import { useActionState } from "react";
import { saveDashboardPreferencesAction } from "@/lib/actions/hub";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import type { DashboardPreferences } from "@/lib/types";

const QUICK_ACTIONS = [
  ["workspace-settings", "Workspace settings"],
  ["members", "Manage members"],
  ["profile", "Edit profile"],
  ["modules", "Open module launcher"],
] as const;

export function QuickActionsPanel({ workspaceId, preferences }: { workspaceId: string; preferences: DashboardPreferences }) {
  const [state, action] = useActionState(saveDashboardPreferencesAction, {});
  const actions = preferences.quick_actions;
  return <Card><CardHeader><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Make it yours</p><h2 className="mt-2 font-display text-2xl font-semibold text-ink">Quick actions</h2><p className="mt-1 text-sm text-[#667878]">Keep your most-used starting points close.</p></div><details className="relative"><summary className="focus-ring cursor-pointer list-none rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Customize</summary><div className="absolute right-0 top-11 z-10 w-72 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-soft"><form action={action} className="space-y-3"><input type="hidden" name="workspaceId" value={workspaceId} />{QUICK_ACTIONS.map(([value, label]) => <label key={value} className="flex items-center gap-3 text-sm text-ink"><input type="checkbox" name="quickActions" value={value} defaultChecked={actions.includes(value)} className="h-4 w-4 accent-[#3b6b58]" />{label}</label>)}<label className="flex items-center gap-3 border-t border-[var(--line)] pt-3 text-sm text-ink"><input type="checkbox" name="showRecent" defaultChecked={preferences.show_recent} className="h-4 w-4 accent-[#3b6b58]" />Show recent items</label><label className="flex items-center gap-3 text-sm text-ink"><input type="checkbox" name="showNotifications" defaultChecked={preferences.show_notifications} className="h-4 w-4 accent-[#3b6b58]" />Show notifications</label><FormMessage error={state.error} message={state.message} /><SubmitButton>Save</SubmitButton></form></div></details></div></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{actions.length === 0 ? <p className="text-sm text-[#667878]">Choose a few quick actions from Customize.</p> : actions.map((actionKey) => <QuickAction key={actionKey} actionKey={actionKey} />)}</div></CardContent></Card>;
}

function QuickAction({ actionKey }: { actionKey: string }) {
  const actions: Record<string, { href: string; label: string; detail: string; icon: string }> = {
    "workspace-settings": { href: "/settings/workspace", label: "Workspace settings", detail: "Shape the shared space", icon: "⚙" },
    members: { href: "/settings/members", label: "Manage members", detail: "Invite or update access", icon: "♧" },
    profile: { href: "/settings/profile", label: "Edit profile", detail: "Keep your identity current", icon: "◉" },
    modules: { href: "#module-launcher", label: "Open modules", detail: "Browse the Elyqora registry", icon: "✦" },
  };
  const item = actions[actionKey];
  if (!item) return null;
  return <a href={item.href} className="focus-ring flex items-center gap-3 rounded-xl border border-[var(--line)] bg-sand/40 p-3 transition hover:border-moss hover:bg-mint"><span className="grid h-9 w-9 place-items-center rounded-lg bg-mint text-moss">{item.icon}</span><span><span className="block text-sm font-semibold text-ink">{item.label}</span><span className="block text-xs text-[#7a8982]">{item.detail}</span></span></a>;
}
