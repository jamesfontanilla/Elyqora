"use client";

import { useActionState } from "react";
import { createWorkspaceAction, renameWorkspaceAction, deleteWorkspaceAction, createInvitationAction, updateMemberRoleAction, removeMemberAction, revokeInvitationAction, acceptInvitationAction, updateProfileAction } from "@/lib/actions/workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/auth/submit-button";
import { getInitials, formatDate } from "@/lib/utils";
import type { Membership, Profile, Workspace } from "@/lib/types";
import type { ActionState } from "@/lib/actions/types";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { getModuleHref, getMobileNavigationModules } from "@/lib/modules/registry";

export function OnboardingForm() {
  const [state, action] = useActionState<ActionState, FormData>(createWorkspaceAction, {});
  return <form action={action} className="space-y-5"><div><Label htmlFor="name">Workspace name</Label><Input id="name" name="name" placeholder="Elyqora Studio" required /></div><div><Label htmlFor="type">What best describes this workspace?</Label><Select id="type" name="type" defaultValue="team"><option value="personal">Personal system</option><option value="team">Small team</option><option value="nonprofit">Nonprofit</option><option value="education">Education</option><option value="operations">Operations team</option></Select></div><FormMessage error={state.error} message={state.message} /><SubmitButton>Create workspace</SubmitButton></form>;
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, {});
  return <form action={action} className="space-y-5"><div><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} required /></div><div><Label htmlFor="timezone">Timezone</Label><Input id="timezone" name="timezone" defaultValue={profile?.timezone ?? "UTC"} required /></div><FormMessage error={state.error} message={state.message} /><SubmitButton>Save profile</SubmitButton></form>;
}

export function RenameWorkspaceForm({ workspace }: { workspace: Workspace }) {
  const [state, action] = useActionState<ActionState, FormData>(renameWorkspaceAction, {});
  return <form action={action} className="space-y-4"><input type="hidden" name="workspaceId" value={workspace.id} /><div><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" name="name" defaultValue={workspace.name} required /></div><FormMessage error={state.error} message={state.message} /><SubmitButton>Save changes</SubmitButton></form>;
}

export function DeleteWorkspaceForm({ workspace }: { workspace: Workspace }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteWorkspaceAction, {});
  return <form action={action} className="space-y-4"><input type="hidden" name="workspaceId" value={workspace.id} /><input type="hidden" name="workspaceName" value={workspace.name} /><div><Label htmlFor="confirmation">Type <span className="font-semibold">{workspace.name}</span> to confirm</Label><Input id="confirmation" name="confirmation" placeholder={workspace.name} required /></div><FormMessage error={state.error} message={state.message} /><Button type="submit" variant="danger">Delete workspace</Button></form>;
}

export function InvitationForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createInvitationAction, {});
  return <form action={action} className="space-y-4"><input type="hidden" name="workspaceId" value={workspaceId} /><div><Label htmlFor="invite-email">Email (optional)</Label><Input id="invite-email" name="email" type="email" placeholder="teammate@example.com" /></div><div><Label htmlFor="invite-role">Role</Label><Select id="invite-role" name="role" defaultValue="member"><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></Select></div><FormMessage error={state.error} message={state.message} />{state.inviteUrl && <div className="rounded-xl border border-moss/20 bg-mint p-3 text-sm text-moss"><div className="mb-1 font-semibold">Copyable invitation link</div><code className="break-all text-xs">{`${typeof window !== "undefined" ? window.location.origin : ""}${state.inviteUrl}`}</code></div>}<SubmitButton>Create link</SubmitButton></form>;
}

export function MemberRow({ member, canManage }: { member: Membership & { profile?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null; role?: { name: string; label: string } | null }; canManage: boolean }) {
  const [roleState, roleAction] = useActionState<ActionState, FormData>(updateMemberRoleAction, {});
  const [removeState, removeAction] = useActionState<ActionState, FormData>(removeMemberAction, {});
  const name = member.profile?.full_name || "Unnamed member";
  return <div className="flex flex-col gap-4 border-b border-[var(--line)] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-sm font-bold text-moss">{getInitials(name)}</span><div className="min-w-0"><div className="truncate font-semibold text-ink">{name}</div><div className="text-xs text-[#7a8982]">{member.status === "active" ? "Active" : member.status}</div></div></div><div className="flex items-center gap-2">{member.role?.name === "owner" ? <Badge>Owner</Badge> : canManage ? <><form action={roleAction} className="flex items-center gap-2"><input type="hidden" name="membershipId" value={member.id} /><Select name="role" defaultValue={member.role?.name ?? "member"} className="min-h-9 w-auto py-1 text-xs"><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></Select><Button type="submit" variant="secondary" className="min-h-9 px-3 text-xs">Save</Button></form><form action={removeAction}><input type="hidden" name="membershipId" value={member.id} /><Button type="submit" variant="ghost" className="min-h-9 px-2 text-xs text-coral">Remove</Button></form></> : <Badge className="bg-sand text-[#667878]">{member.role?.label ?? "Member"}</Badge>}</div>{(roleState.error || removeState.error) && <div className="basis-full"><FormMessage error={roleState.error ?? removeState.error} /></div>}</div>;
}

export function InvitationRow({ invitation, workspaceId, canManage }: { invitation: { id: string; email: string | null; token_preview: string; status: string; expires_at: string }; workspaceId: string; canManage: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(revokeInvitationAction, {});
  return <div className="flex flex-col gap-3 border-b border-[var(--line)] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium text-ink">{invitation.email || "Open invitation link"}</div><div className="text-xs text-[#7a8982]">{invitation.status} · {invitation.token_preview} · expires {formatDate(invitation.expires_at)}</div></div>{canManage && invitation.status === "pending" && <form action={action}><input type="hidden" name="invitationId" value={invitation.id} /><input type="hidden" name="workspaceId" value={workspaceId} /><Button type="submit" variant="ghost" className="min-h-9 px-2 text-xs text-coral">Revoke</Button></form>}{state.error && <FormMessage error={state.error} />}</div>;
}

export function AcceptInvitationForm({ token }: { token: string }) {
  return <form action={async () => { await acceptInvitationAction(token); }}><SubmitButton>Accept invitation</SubmitButton></form>;
}

export function MobileMenu({ workspaces, currentWorkspace, profile }: { workspaces: Workspace[]; currentWorkspace: Workspace; profile: Profile | null }) {
  const modules = getMobileNavigationModules();
  return <details className="relative lg:hidden"><summary className="focus-ring list-none rounded-xl border border-[var(--line)] bg-white p-2 text-ink"><span className="sr-only">Open navigation</span>☰</summary><div className="absolute left-0 top-12 z-30 w-72 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-soft"><WorkspaceSwitcher workspaces={workspaces} currentWorkspace={currentWorkspace} /><div className="mt-5 space-y-1">{modules.map((module) => <a key={module.slug} href={getModuleHref(module)} className="block rounded-xl px-3 py-2 text-sm text-[#667878] hover:bg-sand">{module.name}</a>)}</div><div className="mt-4 border-t border-[var(--line)] pt-3"><div className="mb-2 px-3 text-xs text-[#667878]">{profile?.full_name}</div><a href="/settings/profile" className="block rounded-xl px-3 py-2 text-sm text-[#667878]">Profile</a></div></div></details>;
}

export function ProfileCard({ profile }: { profile: Profile | null }) { return <Card><CardContent><ProfileForm profile={profile} /></CardContent></Card>; }
