import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return <div><p className="eyebrow">Start free</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink">Create your Elyqora</h1><p className="mt-3 mb-8 text-[#667878]">Set up a private account, then shape a workspace around how you work.</p><AuthForm mode="sign-up" /></div>;
}
