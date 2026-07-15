import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser, getProfile } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/workspaces/workspace-forms";
import { getInitials } from "@/lib/utils";

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  return <div className="mx-auto max-w-4xl space-y-8"><div><p className="eyebrow">Settings / Profile</p><h1 className="mt-2 font-display text-4xl font-semibold text-ink">Your profile</h1><p className="mt-3 text-[#667878]">Keep the identity your collaborators see up to date.</p></div><div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]"><Card><CardContent className="flex flex-col items-center text-center"><span className="grid h-24 w-24 place-items-center rounded-[28px] bg-mint font-display text-3xl font-semibold text-moss">{getInitials(profile?.full_name)}</span><h2 className="mt-5 text-xl font-semibold text-ink">{profile?.full_name || "Your name"}</h2><p className="mt-1 text-sm text-[#667878]">{user.email}</p><div className="mt-6 w-full rounded-xl bg-sand p-3 text-left text-xs leading-5 text-[#667878]">Avatar initials are generated locally from your name. No external avatar service is required.</div></CardContent></Card><Card><CardHeader><h2 className="font-display text-2xl font-semibold text-ink">Personal details</h2><p className="mt-1 text-sm text-[#667878]">These details are private to your account unless shown in a workspace.</p></CardHeader><CardContent><ProfileForm profile={profile} /></CardContent></Card></div></div>;
}
