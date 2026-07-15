import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" };

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn("focus-ring inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", { "bg-ink text-white hover:bg-moss": variant === "primary", "border border-[var(--line)] bg-white text-ink hover:bg-sand": variant === "secondary", "text-moss hover:bg-mint": variant === "ghost", "bg-coral text-white hover:bg-[#c86550]": variant === "danger" }, className)} {...props} />;
}
