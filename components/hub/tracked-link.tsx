"use client";

import Link, { type LinkProps } from "next/link";
import { useTransition } from "react";
import { recordRecentItemAction } from "@/lib/actions/hub";

type TrackedLinkProps = LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  workspaceId: string;
  entityId: string;
  entityType: string;
  icon?: string;
  label?: string;
};

export function TrackedLink({ workspaceId, entityId, entityType, icon = "•", label, href, children, onClick, ...props }: TrackedLinkProps) {
  const [, startTransition] = useTransition();
  return <Link href={href} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) { startTransition(() => { void recordRecentItemAction({ workspaceId, entityId, entityType, label: label ?? (typeof children === "string" ? children : String(href)), href: String(href), icon }); }); } }} {...props}>{children}</Link>;
}
