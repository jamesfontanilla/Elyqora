"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command, Search } from "lucide-react";
import { ELYQORA_MODULES, getModuleHref } from "@/lib/modules/registry";
import { Button } from "@/components/ui/button";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => ELYQORA_MODULES.filter((module) => `${module.name} ${module.description}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <><Button type="button" variant="secondary" className="hidden min-h-10 gap-2 px-3 text-xs sm:inline-flex" onClick={() => setOpen(true)}><Command size={15} />Command <kbd className="rounded bg-sand px-1.5 py-0.5 text-[10px]">⌘K</kbd></Button>{open && <div className="fixed inset-0 z-50 grid place-items-start bg-ink/30 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div role="dialog" aria-modal="true" aria-label="Command palette" className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-soft"><div className="flex items-center gap-3 border-b border-[var(--line)] px-4"><Search size={18} className="text-[#8a9992]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules and actions…" className="h-14 flex-1 bg-transparent text-sm text-ink outline-none" /></div><div className="max-h-[55vh] overflow-y-auto p-2">{matches.map((module) => <button type="button" key={module.slug} disabled={!module.enabled} onClick={() => { if (module.enabled) { setOpen(false); router.push(getModuleHref(module)); } }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-moss">{module.icon}</span><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{module.name}</span><span className="block truncate text-xs text-[#7a8982]">{module.enabled ? module.description : "Planned module"}</span></span><span className="ml-auto text-xs text-[#8a9992]">{module.enabled ? "Open" : "Soon"}</span></button>)}{matches.length === 0 && <p className="p-6 text-center text-sm text-[#667878]">No matching modules.</p>}</div><div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[#8a9992]">Press <kbd className="rounded bg-sand px-1.5 py-0.5">Esc</kbd> to close</div></div></div>}</>;
}
