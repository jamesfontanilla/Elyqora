"use client";

export default function TasksError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-6 text-center">
      <h2 className="font-display text-2xl font-semibold text-ink">We hit a snag loading Tasks.</h2>
      <p className="mt-2 text-sm leading-6 text-[#667878]">{error.message}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">Try again</button>
    </div>
  );
}
