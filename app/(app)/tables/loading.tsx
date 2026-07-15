import { Card, CardContent } from "@/components/ui/card";

export default function TablesLoading() {
  return <div className="space-y-4"><Card><CardContent><div className="h-24 animate-pulse rounded-xl bg-sand/60" /></CardContent></Card><Card><CardContent><div className="h-48 animate-pulse rounded-xl bg-sand/60" /></CardContent></Card></div>;
}
