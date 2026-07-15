import { notFound } from "next/navigation";
import { MarkdownPreview } from "@/components/docs/markdown-preview";
import { getPublicDocument } from "@/lib/docs/queries";

export default async function PublicDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = await getPublicDocument(slug);
  if (!document) notFound();
  return <main className="min-h-screen bg-[var(--background)] px-4 py-12 sm:px-8"><article className="mx-auto max-w-3xl"><div className="mb-8 flex items-center gap-3 text-sm font-semibold text-moss"><span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-mint">E</span>Elyqora Docs <span className="text-[#9aa8a2]">·</span> Public read-only</div><h1 className="font-display text-5xl font-semibold tracking-tight text-ink">{document.title}</h1><p className="mt-3 text-sm text-[#8a9992]">Published {new Date(document.published_at).toLocaleDateString()}</p><div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-10"><MarkdownPreview content={document.content_md} /></div></article></main>;
}
