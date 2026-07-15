import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser, getProfile, getUserWorkspaces } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [profile, workspaces] = await Promise.all([getProfile(user.id), getUserWorkspaces(user.id)]);
  const currentWorkspace = workspaces.length ? await getCurrentWorkspace(user.id) : null;
  if (!currentWorkspace) {
    redirect("/onboarding");
    return null;
  }
  return <AppShell profile={profile} workspaces={workspaces} currentWorkspace={currentWorkspace}>{children}</AppShell>;
}
