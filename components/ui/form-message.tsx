import React from "react";

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return <p role="status" className={error ? "rounded-xl bg-[#fff0ed] px-3 py-2 text-sm text-[#a3412e]" : "rounded-xl bg-mint px-3 py-2 text-sm text-moss"}>{error ?? message}</p>;
}
