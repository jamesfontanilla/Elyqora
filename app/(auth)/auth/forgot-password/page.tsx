import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <div><p className="eyebrow">Account recovery</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink">Reset your password</h1><p className="mt-3 mb-8 text-[#667878]">We’ll send a secure link if an account exists for that email.</p><AuthForm mode="forgot" /></div>;
}
