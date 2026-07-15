export type ActionState = {
  error?: string;
  message?: string;
  inviteUrl?: string;
};

export function actionError(error: unknown, fallback = "Something went wrong. Please try again."): ActionState {
  if (error instanceof Error && "digest" in error && String((error as Error & { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
    throw error;
  }
  const message = error instanceof Error ? error.message : fallback;
  return { error: message };
}
