export default function NotesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded-full bg-sand" />
      <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-sand" />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-sand" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[520px] animate-pulse rounded-3xl bg-sand" />
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-3xl bg-sand" />
          <div className="h-44 animate-pulse rounded-3xl bg-sand" />
        </div>
      </div>
    </div>
  );
}
