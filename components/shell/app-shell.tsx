import Link from "next/link";
import { Bell } from "lucide-react";
import { getModuleHref, getNavigationModules } from "@/lib/modules/registry";
import type { Profile, Workspace } from "@/lib/types";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { MobileMenu } from "@/components/workspaces/workspace-forms";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CommandPalette } from "@/components/shell/command-palette";
import { ModuleLauncher } from "@/components/shell/module-launcher";
import { ProfileMenu } from "@/components/shell/profile-menu";
import { NavItem } from "@/components/shell/nav-item";

export function AppShell({ children, profile, workspaces, currentWorkspace }: { children: React.ReactNode; profile: Profile | null; workspaces: Workspace[]; currentWorkspace: Workspace }) {
  const primary = getNavigationModules("primary");
  const workspace = getNavigationModules("workspace");
  const settings = getNavigationModules("settings");
  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <aside className="hidden w-72 shrink-0 border-r border-[var(--line)] bg-white p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <div className="mb-8 flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-ink text-lg font-bold text-mint">E</div><div><div className="font-display text-xl font-semibold text-ink">Elyqora</div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">Free workspace</div></div></div>
        <WorkspaceSwitcher workspaces={workspaces} currentWorkspace={currentWorkspace} />
        <nav className="mt-8 space-y-1" aria-label="Primary navigation">
          <div className="eyebrow mb-3 px-3">Workspace</div>
          {[...primary, ...workspace].map((module) => <NavItem key={module.slug} href={getModuleHref(module)} icon={module.icon} label={module.name} />)}
        </nav>
        <nav className="mt-auto space-y-1" aria-label="Settings navigation">
          <div className="eyebrow mb-3 px-3">Manage</div>
          {settings.map((module) => <NavItem key={module.slug} href={getModuleHref(module)} icon={module.icon} label={module.name} />)}
          <SignOutButton />
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-[var(--line)] bg-[rgba(247,248,244,0.88)] px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3"><MobileMenu workspaces={workspaces} currentWorkspace={currentWorkspace} profile={profile} /><Breadcrumbs workspaceName={currentWorkspace.name} /><div className="font-display text-xl font-semibold text-ink sm:hidden">Elyqora</div></div>
          <div className="flex items-center gap-2"><CommandPalette /><ModuleLauncher workspaceId={currentWorkspace.id} /><Link href="/hub#notifications" className="focus-ring rounded-xl border border-[var(--line)] bg-white p-2.5 text-[#667878]" aria-label="Notifications"><Bell size={17} /></Link><ProfileMenu profile={profile} /></div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
