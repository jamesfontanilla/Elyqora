import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/guards";
import { AcceptInvitationForm } from "@/components/workspaces/workspace-forms";

export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  return <main className="grid min-h-screen place-items-center bg-sand p-5"><div className="surface w-full max-w-md p-6 text-center sm:p-10"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-xl font-bold text-mint">E</div><p className="eyebrow mt-8">Workspace invitation</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink">You’ve been invited.</h1><p className="mt-3 mb-8 leading-7 text-[#667878]">Join this Elyqora workspace to collaborate with your team. You’ll receive the Member role by default.</p>{user ? <AcceptInvitationForm token={token} /> : <div className="space-y-3"><Link href={`/auth/sign-in?next=/invite/${token}`} className="block rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-moss">Sign in to accept</Link><p className="text-xs text-[#8a9992]">New to Elyqora? <Link href={`/auth/sign-up?next=/invite/${token}`} className="font-semibold text-moss hover:underline">Create an account</Link></p></div>}</div></main>;
}
