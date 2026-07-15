"use client";

import type { ReactNode } from "react";
import { isSafeDocumentLink } from "@/lib/docs/constants";

export function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let codeLines: string[] | null = null;
  let codeLanguage = "";
  let listItems: ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const List = listType;
    blocks.push(<List key={`list-${blocks.length}`} className="my-3 space-y-1 pl-6 marker:text-moss">{listItems}</List>);
    listItems = [];
    listType = null;
  };

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      if (codeLines) {
        blocks.push(<pre key={`code-${index}`} className="my-4 overflow-x-auto rounded-xl bg-ink p-4 text-sm leading-6 text-mint"><code>{codeLines.join("\n")}</code></pre>);
        codeLines = null;
        codeLanguage = "";
      } else {
        flushList();
        codeLines = [];
        codeLanguage = line.slice(3).trim();
      }
      return;
    }
    if (codeLines) {
      codeLines.push(line);
      return;
    }
    if (!line.trim()) {
      flushList();
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const className = level === 1 ? "mt-7 text-3xl" : level === 2 ? "mt-6 text-2xl" : "mt-5 text-xl";
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(<Tag key={`heading-${index}`} className={`${className} font-display font-semibold text-ink`}>{renderInline(heading[2])}</Tag>);
      return;
    }
    const checkbox = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checkbox) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(<li key={`check-${index}`} className="flex list-none items-center gap-2"><span className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${checkbox[1].toLowerCase() === "x" ? "border-moss bg-mint text-moss" : "border-[var(--line)]"}`}>{checkbox[1].toLowerCase() === "x" ? "✓" : ""}</span><span>{renderInline(checkbox[2])}</span></li>);
      return;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(<li key={`ul-${index}`}>{renderInline(unordered[1])}</li>);
      return;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listItems.push(<li key={`ol-${index}`}>{renderInline(ordered[1])}</li>);
      return;
    }
    if (line.startsWith("> ")) {
      flushList();
      blocks.push(<blockquote key={`quote-${index}`} className="my-4 border-l-4 border-moss/30 pl-4 italic text-[#667878]">{renderInline(line.slice(2))}</blockquote>);
      return;
    }
    flushList();
    blocks.push(<p key={`p-${index}`} className="my-3 leading-7 text-[#43564d]">{renderInline(line)}</p>);
  });
  flushList();
  const finalCodeLines = codeLines as string[] | null;
  if (finalCodeLines) blocks.push(<pre key="code-final" className="my-4 overflow-x-auto rounded-xl bg-ink p-4 text-sm leading-6 text-mint"><code>{finalCodeLines.join("\n")}</code></pre>);
  return <div data-code-language={codeLanguage} className="document-markdown max-w-none">{blocks.length ? blocks : <p className="text-sm text-[#8a9992]">Nothing written yet.</p>}</div>;
}

function renderInline(value: string): ReactNode[] {
  const parts = value.split(/(\[[^\]]+\]\([^\)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) return isSafeDocumentLink(link[2]) ? <a key={index} href={link[2]} className="font-semibold text-moss underline" target={link[2].startsWith("http") ? "_blank" : undefined} rel={link[2].startsWith("http") ? "noreferrer" : undefined}>{link[1]}</a> : <span key={index}>{link[1]}</span>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-sand px-1.5 py-0.5 text-[0.9em] text-moss">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return <span key={index}>{part}</span>;
  });
}
