"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function TablesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <div className="rounded-2xl border border-coral/20 bg-[#fff7f4] p-8 text-center"><h2 className="font-display text-2xl font-semibold text-ink">Tables hit a problem</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667878]">The module could not load cleanly. Try again and we&apos;ll pick up from the same place.</p><Button className="mt-4" onClick={() => reset()}>Try again</Button></div>;
}
