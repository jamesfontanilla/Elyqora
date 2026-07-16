import React, { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm text-ink placeholder:text-[#9aa8a2]", className)} {...props} />;
}
