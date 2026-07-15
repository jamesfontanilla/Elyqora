import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { OnboardingForm } from "@/components/workspaces/workspace-forms";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/sign-in");
    return null;
  }
  if (await getCurrentWorkspace(user.id)) redirect("/hub");
  return <main className="min-h-screen bg-sand px-5 py-10 sm:px-10"><div className="mx-auto max-w-xl"><div className="mb-10 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink font-bold text-mint">E</div><div className="font-display text-2xl font-semibold text-ink">Elyqora</div></div><div className="surface p-6 sm:p-10"><p className="eyebrow">Your first step</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink">Give your workspace a home.</h1><p className="mt-3 mb-8 max-w-md leading-7 text-[#667878]">You can always rename it or create more workspaces later. This first workspace is where you’ll land in the Elyqora Hub.</p><OnboardingForm /></div></div></main>;
}
