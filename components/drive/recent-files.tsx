import Link from "next/link";
import { Clock3, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DriveFile } from "@/lib/types";

export function RecentDriveFiles({ files, visible }: { files: DriveFile[]; visible: boolean }) {
  if (!visible || files.length === 0) return null;
  return <Card><CardHeader><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-moss"><Clock3 size={16} /></span><div><p className="eyebrow">Your trail</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink">Recent files</h2></div></div></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{files.map((file) => <Link key={file.id} href={`/files?preview=${file.id}`} className="focus-ring flex min-w-0 items-center gap-3 rounded-xl border border-[var(--line)] bg-sand/30 p-3 transition hover:bg-mint"><FileText size={16} className="shrink-0 text-moss" /><span className="truncate text-sm font-semibold text-ink">{file.name}</span></Link>)}</div></CardContent></Card>;
}
