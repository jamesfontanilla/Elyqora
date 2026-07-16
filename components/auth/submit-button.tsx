"use client";

import React, { type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function SubmitButton({ children, pendingLabel = "Working...", variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending}>{pending ? pendingLabel : children}</Button>;
}
