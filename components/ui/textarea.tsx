import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("focus-ring min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink shadow-none outline-none transition placeholder:text-[#a0aca6] focus:border-moss", className)} {...props} />;
}
