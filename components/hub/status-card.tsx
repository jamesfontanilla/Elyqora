"use client";

import { useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Status = "checking" | "healthy" | "unavailable";

export function StatusCard() {
  const [status, setStatus] = useState<Status>("checking");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function checkHealth() {
    setStatus("checking");
    try {
      const response = await fetch("/health", { cache: "no-store" });
      setStatus(response.ok ? "healthy" : "unavailable");
    } catch {
      setStatus("unavailable");
    } finally {
      setCheckedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }
  }

  useEffect(() => { void checkHealth(); }, []);
  const healthy = status === "healthy";
  return <Card className="bg-ink text-white"><CardContent><div className="mb-7 flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${healthy ? "bg-mint text-ink" : "bg-[#284a42] text-mint"}`}>{status === "checking" ? <RefreshCw className="animate-spin" size={18} /> : healthy ? <Check size={18} /> : <X size={18} />}</span><Badge className={healthy ? "bg-[#284a42] text-mint" : "bg-[#5b3d38] text-[#ffd4cb]"}>{status === "checking" ? "Checking" : healthy ? "Operational" : "Unavailable"}</Badge></div><div className="text-sm text-[#c9ddd2]">System status</div><div className="mt-1 text-2xl font-semibold">{healthy ? "Elyqora is healthy" : status === "checking" ? "Checking application" : "Check your deployment"}</div><div className="mt-2 flex items-center justify-between gap-3 text-sm text-[#9db9aa]"><span>{checkedAt ? `Checked ${checkedAt}` : "Reading health route"}</span><button type="button" onClick={() => void checkHealth()} className="focus-ring rounded-lg p-1 text-mint" aria-label="Refresh system status"><RefreshCw size={15} /></button></div></CardContent></Card>;
}
