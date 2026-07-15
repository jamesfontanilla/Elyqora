import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <div><p className="eyebrow">Welcome back</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink">Sign in to Elyqora</h1><p className="mt-3 mb-8 text-[#667878]">Pick up where your workspace left off.</p><AuthForm mode="sign-in" /></div>;
}
