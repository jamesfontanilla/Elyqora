"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavigationPathActive } from "@/lib/navigation";

export function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const active = isNavigationPathActive(pathname, href);

  return <Link href={href} aria-current={active ? "page" : undefined} className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-mint text-moss" : "text-[#667878] hover:bg-sand hover:text-ink"}`}><span className="grid h-6 w-6 place-items-center text-base">{icon}</span>{label}</Link>;
}
