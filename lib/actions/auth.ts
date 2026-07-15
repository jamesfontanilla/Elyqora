"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { actionError, type ActionState } from "@/lib/actions/types";

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function signInAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "We could not sign you in with those details." };
    revalidatePath("/", "layout");
    redirect("/hub");
  } catch (error) {
    return actionError(error);
  }
  return { error: "We could not sign you in." };
}

export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.extend({ fullName: z.string().trim().min(2, "Enter your name.").max(80) }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName } },
    });
    if (error) return { error: error.message };
    if (data.session) redirect("/onboarding");
    return { message: "Account created. Check your inbox to confirm your email, then sign in." };
  } catch (error) {
    return actionError(error);
  }
}

export async function requestPasswordResetAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.string().trim().email("Enter a valid email address.").safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your email address." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${getSiteUrl()}/auth/reset-password`,
    });
    if (error) return { error: error.message };
    return { message: "If an account exists for that email, a reset link is on its way." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  const parsed = z.string().min(8, "Password must be at least 8 characters.").safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a stronger password." };
  if (password !== confirmation) return { error: "Passwords do not match." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) return { error: error.message };
    return { message: "Password updated. You can continue using Elyqora." };
  } catch (error) {
    return actionError(error);
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/sign-in");
}
