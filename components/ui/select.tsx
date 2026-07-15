import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm text-ink", className)} {...props} />;
}
