import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Profile } from "@/lib/types";
import { getInitials } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function ProfileMenu({ profile }: { profile: Profile | null }) {
  return <details className="relative"><summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-2 py-1.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-xs font-bold text-moss">{getInitials(profile?.full_name)}</span><span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{profile?.full_name || "Your profile"}</span><ChevronDown className="hidden text-[#667878] sm:block" size={15} /></summary><div className="absolute right-0 top-12 z-30 w-52 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-soft"><div className="px-3 py-2"><div className="truncate text-sm font-semibold text-ink">{profile?.full_name || "Your profile"}</div><div className="text-xs text-[#8a9992]">Account menu</div></div><div className="my-1 h-px bg-[var(--line)]" /><Link href="/settings/profile" className="block rounded-xl px-3 py-2 text-sm text-[#667878] hover:bg-sand">Profile settings</Link><SignOutButton /></div></details>;
}
