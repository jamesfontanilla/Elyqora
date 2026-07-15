"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, requestPasswordResetAction, updatePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ActionState } from "@/lib/actions/types";

type AuthMode = "sign-in" | "sign-up" | "forgot" | "reset";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const action = mode === "sign-in" ? signInAction : mode === "sign-up" ? signUpAction : mode === "forgot" ? requestPasswordResetAction : updatePasswordAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  return (
    <form action={formAction} className="space-y-4">
      {isSignUp && <div><Label htmlFor="fullName">Name</Label><Input id="fullName" name="fullName" autoComplete="name" placeholder="Your name" required /></div>}
      {!isReset && <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>}
      {!isForgot && <div><Label htmlFor="password">{isReset ? "New password" : "Password"}</Label><Input id="password" name="password" type="password" autoComplete={isReset ? "new-password" : isSignUp ? "new-password" : "current-password"} placeholder="At least 8 characters" required /></div>}
      {isReset && <div><Label htmlFor="confirmation">Confirm new password</Label><Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required /></div>}
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel={isForgot ? "Sending…" : "Please wait…"}>{isSignUp ? "Create account" : isForgot ? "Send reset link" : isReset ? "Update password" : "Sign in"}</SubmitButton>
      {mode === "sign-in" && <div className="flex items-center justify-between text-sm"><Link className="text-moss hover:underline" href="/auth/forgot-password">Forgot password?</Link><Link className="text-moss hover:underline" href="/auth/sign-up">Create account</Link></div>}
      {isSignUp && <p className="text-sm text-[#667878]">Already have an account? <Link className="font-semibold text-moss hover:underline" href="/auth/sign-in">Sign in</Link></p>}
      {isForgot && <p className="text-sm text-[#667878]"><Link className="font-semibold text-moss hover:underline" href="/auth/sign-in">Return to sign in</Link></p>}
      {isReset && <Link href="/auth/sign-in"><Button type="button" variant="ghost">Back to sign in</Button></Link>}
    </form>
  );
}
