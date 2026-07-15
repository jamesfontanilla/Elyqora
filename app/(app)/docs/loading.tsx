import { Card, CardContent } from "@/components/ui/card";

export default function DocsLoading() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading Docs"><div className="h-10 w-64 animate-pulse rounded-xl bg-sand" /><div className="grid gap-4 md:grid-cols-3"><Card><CardContent><div className="h-24 animate-pulse rounded-xl bg-sand" /></CardContent></Card><Card><CardContent><div className="h-24 animate-pulse rounded-xl bg-sand" /></CardContent></Card><Card><CardContent><div className="h-24 animate-pulse rounded-xl bg-sand" /></CardContent></Card></div><Card><CardContent><div className="h-80 animate-pulse rounded-xl bg-sand" /></CardContent></Card></div>;
}
