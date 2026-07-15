import { describe, expect, it } from "vitest";
import { canReadDriveRecord, isDriveAttachmentTarget } from "@/lib/drive/access";
import { DRIVE_ALLOWED_MIME_TYPES, sanitizeDriveFilename, validateDriveUpload } from "@/lib/drive/constants";

const settings = {
  workspace_id: "workspace-a",
  max_file_size_bytes: 1024,
  quota_bytes: 4096,
  allowed_mime_types: [...DRIVE_ALLOWED_MIME_TYPES],
  created_at: "",
  updated_at: "",
};

describe("Drive Lite file safety", () => {
  it("sanitizes path separators and hidden-name prefixes", () => {
    expect(sanitizeDriveFilename("../private/report?.txt")).toBe("_private_report_.txt");
  });

  it("rejects unsupported MIME types and oversized files", () => {
    expect(validateDriveUpload({ name: "run.exe", type: "application/x-msdownload", size: 10 }, settings).ok).toBe(false);
    expect(validateDriveUpload({ name: "large.txt", type: "text/plain", size: 4097 }, settings).ok).toBe(false);
  });

  it("accepts safe text and returns a safe display name", () => {
    const result = validateDriveUpload({ name: "notes.txt", type: "text/plain", size: 10 }, settings);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.safeName).toBe("notes.txt");
  });
});

describe("Drive Lite authorization and attachments", () => {
  it("requires workspace identity and file permission", () => {
    const record = { userId: "user-a", workspaceId: "workspace-a", recordWorkspaceId: "workspace-a", createdBy: "user-b", accessLevel: "restricted" as const, sharePermission: "read" as const };
    expect(canReadDriveRecord(record)).toBe(true);
    expect(canReadDriveRecord({ ...record, workspaceId: "workspace-b" })).toBe(false);
    expect(canReadDriveRecord({ ...record, sharePermission: null })).toBe(false);
    expect(canReadDriveRecord({ ...record, deleted: true })).toBe(false);
  });

  it("limits attachment targets to future workspace modules", () => {
    expect(isDriveAttachmentTarget("docs")).toBe(true);
    expect(isDriveAttachmentTarget("notes")).toBe(true);
    expect(isDriveAttachmentTarget("helpdesk")).toBe(true);
    expect(isDriveAttachmentTarget("random-table")).toBe(false);
  });
});
