"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getModuleBySlug } from "@/lib/modules/registry";

export function Breadcrumbs({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const labels = parts.map((part) => getModuleBySlug(part)?.name ?? part.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
  return <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm text-[#667878] sm:flex"><Link href="/hub" className="hover:text-ink">{workspaceName}</Link>{labels.map((label, index) => <span key={`${label}-${index}`} className="flex items-center gap-2"><span aria-hidden="true">/</span><span className={index === labels.length - 1 ? "font-semibold text-ink" : ""}>{label}</span></span>)}</nav>;
}
