import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, getMembership } from "@/lib/auth/guards";
import { getCurrentWorkspace, getWorkspaceAuditEvents } from "@/lib/workspaces/current";
import { RenameWorkspaceForm, DeleteWorkspaceForm } from "@/components/workspaces/workspace-forms";
import { formatRelativeDate } from "@/lib/utils";

export default async function WorkspaceSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const membership = await getMembership(workspace.id, user.id);
  const events = await getWorkspaceAuditEvents(workspace.id);
  const canUpdate = membership?.role.name === "owner" || membership?.role.name === "admin";
  const canDelete = membership?.role.name === "owner";
  return <div className="mx-auto max-w-5xl space-y-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Settings / Workspace</p><h1 className="mt-2 font-display text-4xl font-semibold text-ink">{workspace.name}</h1><p className="mt-3 text-[#667878]">Shape the shared space and keep a clear record of important changes.</p></div><div className="flex gap-2"><Link href="/settings/profile" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[#667878] hover:bg-sand">Profile</Link><Link href="/settings/members" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[#667878] hover:bg-sand">Members</Link></div></div><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center justify-between"><div><h2 className="font-display text-2xl font-semibold text-ink">Workspace details</h2><p className="mt-1 text-sm text-[#667878]">Only owners and admins can rename this workspace.</p></div><Badge>{membership?.role.label ?? "Member"}</Badge></div></CardHeader><CardContent>{canUpdate ? <RenameWorkspaceForm workspace={workspace} /> : <div className="rounded-xl bg-sand p-4 text-sm leading-6 text-[#667878]">You have read access to this workspace. Ask an owner or admin to update its details.</div>}</CardContent></Card><Card><CardHeader><h2 className="font-display text-2xl font-semibold text-ink">Workspace facts</h2></CardHeader><CardContent className="space-y-4 text-sm"><Fact label="Type" value={workspace.workspace_type} /><Fact label="Workspace ID" value={workspace.id} mono /><Fact label="Your access" value={membership?.role.label ?? "Unknown"} /><Fact label="Recent events" value={`${events.length} loaded`} /></CardContent></Card></div>{canDelete && <Card className="border-coral/30"><CardHeader><h2 className="font-display text-2xl font-semibold text-coral">Delete workspace</h2><p className="mt-1 text-sm leading-6 text-[#667878]">This uses a soft-delete flow and removes the workspace from member access. Type the workspace name to confirm.</p></CardHeader><CardContent><DeleteWorkspaceForm workspace={workspace} /></CardContent></Card>}{events.length > 0 && <Card><CardHeader><h2 className="font-display text-2xl font-semibold text-ink">Recent audit events</h2></CardHeader><CardContent><div className="space-y-1">{events.slice(0, 8).map((event) => <div key={event.id} className="flex flex-col justify-between gap-1 border-b border-[var(--line)] py-3 text-sm last:border-0 sm:flex-row"><span className="font-medium text-ink">{event.action}</span><span className="text-[#8a9992]">{formatRelativeDate(event.created_at)}</span></div>)}</div></CardContent></Card>}</div>;
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"><span className="text-[#667878]">{label}</span><span className={mono ? "max-w-[65%] break-all text-right font-mono text-xs text-ink" : "text-right font-semibold capitalize text-ink"}>{value}</span></div>; }
