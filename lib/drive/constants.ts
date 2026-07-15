import type { DriveAttachmentTarget, DriveStorageSettings } from "@/lib/types";

export const DRIVE_BUCKET = "elyqora-drive";
export const DRIVE_MAX_BUCKET_BYTES = 10 * 1024 * 1024;
export const DRIVE_DEFAULT_QUOTA_BYTES = 100 * 1024 * 1024;

export const DRIVE_ALLOWED_MIME_TYPES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export const DRIVE_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
]);

export const DRIVE_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export const DRIVE_ATTACHMENT_TARGETS: Array<{ value: DriveAttachmentTarget; label: string }> = [
  { value: "docs", label: "Docs" },
  { value: "expenses", label: "Expenses" },
  { value: "projects", label: "Projects" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "contacts", label: "Contacts" },
];

export function sanitizeDriveFilename(filename: string) {
  const normalized = filename.normalize("NFKC");
  const cleaned = normalized
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 160);
  return cleaned || "untitled-file";
}

export function validateDriveUpload(file: { name: string; type: string; size: number }, settings: DriveStorageSettings) {
  const safeName = sanitizeDriveFilename(file.name);
  if (!settings.allowed_mime_types.includes(file.type)) {
    return { ok: false as const, error: "This file type is not allowed in the workspace." };
  }
  if (file.size <= 0) return { ok: false as const, error: "Empty files cannot be uploaded." };
  if (file.size > settings.max_file_size_bytes) {
    return { ok: false as const, error: `This file exceeds the ${formatBytes(settings.max_file_size_bytes)} file-size limit.` };
  }
  return { ok: true as const, safeName };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function isDrivePreviewableMime(mimeType: string) {
  return DRIVE_TEXT_MIME_TYPES.has(mimeType) || DRIVE_IMAGE_MIME_TYPES.has(mimeType);
}
