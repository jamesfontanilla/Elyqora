"use client";

import { Button } from "@/components/ui/button";

export default function DocsError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-2xl border border-coral/20 bg-[#fff7f4] p-8 text-center"><p className="eyebrow text-coral">Docs unavailable</p><h1 className="mt-2 font-display text-3xl font-semibold text-ink">That document space did not load.</h1><p className="mt-3 text-sm leading-6 text-[#667878]">Check your connection or Supabase migration status, then try again.</p><Button type="button" variant="secondary" className="mt-6" onClick={() => reset()}>Try again</Button></div>;
}
