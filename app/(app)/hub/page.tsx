import Link from "next/link";
import { ArrowUpRight, Bell, CalendarDays, CheckSquare, FolderKanban, LockKeyhole, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { getHubData } from "@/lib/hub/queries";
import { getHubEmptyState, getModuleHref } from "@/lib/modules/registry";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import { formatTaskDueDate } from "@/lib/tasks/constants";
import { StatusCard } from "@/components/hub/status-card";
import { QuickActionsPanel } from "@/components/hub/preferences";
import { TrackedLink } from "@/components/hub/tracked-link";

export default async function HubPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const hub = await getHubData(user.id);
  if (!hub) return null;

  const pinned = new Set(hub.pinnedModules.map((item) => item.module_slug));
  const orderedModules = [...hub.enabledModules].sort((left, right) => Number(pinned.has(right.slug)) - Number(pinned.has(left.slug)));
  const firstName = hub.profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">{hub.workspace.workspace_type} workspace</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Good to see you, {firstName}.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667878]">Your central view for the work that matters in <span className="font-semibold text-ink">{hub.workspace.name}</span>.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/workspace"><Button variant="secondary">Workspace settings <ArrowUpRight size={16} className="ml-2" /></Button></Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard />
        <StatCard icon={<Users size={18} />} label="Workspace members" value={String(hub.membersCount)} detail="People with active access" />
        <StatCard icon={<FolderKanban size={18} />} label="Active projects" value={String(hub.activeProjects.length)} detail="Projects module not configured" />
        <StatCard icon={<CheckSquare size={18} />} label="Assigned tasks" value={String(hub.assignedTasks.length)} detail="Tasks that need your attention" />
      </section>

      <QuickActionsPanel workspaceId={hub.workspace.id} preferences={hub.preferences} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {hub.preferences.show_recent && (
          <Card id="recent-items">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Your trail</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Recently opened</h2>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a9992]">Last 8</span>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {hub.recentItems.length === 0 ? (
                <EmptyLine title="Nothing opened yet" body="Open a module or workspace setting and it will appear here." />
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {hub.recentItems.map((item) => (
                    <TrackedLink key={item.id} href={item.href} workspaceId={hub.workspace.id} entityId={item.entity_id} entityType={item.entity_type} icon={item.icon} className="flex items-center gap-3 py-3 transition hover:bg-sand/50">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-sm text-moss">{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{item.label}</span>
                        <span className="block text-xs text-[#8a9992]">{item.entity_type} · {formatRelativeDate(item.last_opened_at)}</span>
                      </span>
                      <ArrowUpRight size={16} className="text-[#9aa8a2]" />
                    </TrackedLink>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hub.preferences.show_notifications && (
          <Card id="notifications">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Keep in the loop</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Recent notifications</h2>
                </div>
                <Bell size={18} className="text-moss" />
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {hub.notifications.length === 0 ? (
                <EmptyLine title="You're all caught up" body="New workspace updates will appear here." />
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {hub.notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} workspaceId={hub.workspace.id} />)}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <ModuleSummaryCard
          title="Assigned tasks"
          eyebrow="Your focus"
          icon={<CheckSquare size={18} />}
          empty={getHubEmptyState("tasks", hub.assignedTasks.length)}
        >
          {hub.assignedTasks.length > 0 && (
            <div className="space-y-2">
              {hub.assignedTasks.slice(0, 4).map((task) => (
                <TrackedLink key={task.id} href={`/tasks/${task.id}`} workspaceId={hub.workspace.id} entityId={task.id} entityType="task" icon="✓" className="flex items-start gap-3 rounded-xl bg-sand/40 p-3 transition hover:bg-mint">
                  <CheckSquare size={15} className="mt-0.5 shrink-0 text-moss" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{task.title}</span>
                    <span className="mt-1 block text-xs text-[#8a9992]">{task.due_date ? formatTaskDueDate(task.due_date) : task.status.replaceAll("_", " ")}</span>
                  </span>
                </TrackedLink>
              ))}
              {hub.assignedTasks.length > 4 && <Link href="/tasks" className="inline-flex text-xs font-semibold text-moss hover:underline">View all tasks</Link>}
            </div>
          )}
        </ModuleSummaryCard>
        <ModuleSummaryCard title="Upcoming calendar" eyebrow="Your time" icon={<CalendarDays size={18} />} empty={getHubEmptyState("calendar", hub.upcomingEvents.length)} />
        <ModuleSummaryCard title="Active projects" eyebrow="Your outcomes" icon={<FolderKanban size={18} />} empty={getHubEmptyState("projects", hub.activeProjects.length)} />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow">Elyqora ecosystem</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Enabled modules</h2>
          </div>
          <span className="text-sm text-[#667878]">{hub.enabledModules.length} enabled · {pinned.size} pinned</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderedModules.map((module) => (
            <Link key={module.slug} href={getModuleHref(module)} className="focus-ring">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-moss">
                <CardContent>
                  <div className="mb-5 flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-lg text-moss">{module.icon}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#8a9992]">{pinned.has(module.slug) ? "Pinned" : "Open"}<ArrowUpRight size={15} /></span>
                  </div>
                  <h3 className="font-semibold text-ink">{module.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#667878]">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 text-xs text-[#8a9992]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-mint text-moss">{getInitials(hub.profile?.full_name)}</span>Personalized for your account</div>
        <div className="flex items-center gap-3 text-xs text-[#8a9992]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sand text-moss"><LockKeyhole size={15} /></span>Tenant-aware workspace data</div>
        <div className="flex items-center gap-3 text-xs text-[#8a9992]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sand text-moss">↗</span>Bounded summary queries</div>
        <div className="flex items-center gap-3 text-xs text-[#8a9992]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sand text-moss">✦</span>More modules when ready</div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-7 flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-moss">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a9992]">Summary</span>
        </div>
        <div className="text-sm text-[#667878]">{label}</div>
        <div className="mt-1 text-3xl font-semibold text-ink">{value}</div>
        <p className="mt-2 text-xs leading-5 text-[#8a9992]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ModuleSummaryCard({ title, eyebrow, icon, empty, children }: { title: string; eyebrow: string; icon: React.ReactNode; empty: { title: string; body: string } | null; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">{title}</h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand text-moss">{icon}</span>
        </div>
        {empty ? <EmptyLine title={empty.title} body={empty.body} /> : children ?? <p className="text-sm text-[#667878]">Summary data is ready.</p>}
      </CardContent>
    </Card>
  );
}

function EmptyLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-sand/60 p-4">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <p className="mt-1 text-sm leading-6 text-[#667878]">{body}</p>
      <a href="#module-launcher" className="mt-3 inline-flex text-xs font-semibold text-moss hover:underline">Browse modules</a>
    </div>
  );
}

function NotificationRow({ notification, workspaceId }: { notification: { id: string; title: string; body: string; kind: string; href: string | null; read_at: string | null; created_at: string }; workspaceId: string }) {
  const content = (
    <>
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-[#dce5df]" : notification.kind === "success" ? "bg-moss" : "bg-coral"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{notification.title}</span>
        <span className="mt-1 block text-xs leading-5 text-[#667878]">{notification.body}</span>
        <span className="mt-1 block text-xs text-[#8a9992]">{formatRelativeDate(notification.created_at)}</span>
      </span>
    </>
  );
  return notification.href ? (
    <TrackedLink href={notification.href} workspaceId={workspaceId} entityId={notification.id} entityType="notification" icon="•" className="flex gap-3 py-3 transition hover:bg-sand/50">
      {content}
    </TrackedLink>
  ) : (
    <div className="flex gap-3 py-3">{content}</div>
  );
}
