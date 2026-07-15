import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return <div><p className="eyebrow">Almost there</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink">Choose a new password</h1><p className="mt-3 mb-8 text-[#667878]">Use at least eight characters you will remember.</p><AuthForm mode="reset" /></div>;
}
