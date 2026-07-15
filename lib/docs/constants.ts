import type { DocumentLinkTarget } from "@/lib/types";

export const DOCUMENT_LINK_TARGETS: Array<{ value: DocumentLinkTarget; label: string }> = [
  { value: "project", label: "Project" },
  { value: "task", label: "Task" },
  { value: "contact", label: "Contact" },
  { value: "ticket", label: "Ticket" },
  { value: "event", label: "Event" },
  { value: "course", label: "Learning course" },
];

export function sanitizeDocumentTitle(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "Untitled document";
}

export function normalizeDocumentTag(value: string) {
  return value.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
}

export function getDocumentExcerpt(content: string, length = 180) {
  return content.replace(/[`*_>#\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, length);
}

export function isSafeDocumentLink(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}
