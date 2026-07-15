"use client";

import { useActionState } from "react";
import { attachDriveFileAction } from "@/lib/actions/drive";
import { DRIVE_ATTACHMENT_TARGETS } from "@/lib/drive/constants";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ActionState } from "@/lib/actions/types";
import type { DriveAttachmentTarget } from "@/lib/types";

export interface AttachmentPickerFile {
  id: string;
  name: string;
  sizeBytes?: number;
}

export function AttachmentPicker({ workspaceId, targetType, targetId, files, attachedFileIds = [] }: { workspaceId: string; targetType: DriveAttachmentTarget; targetId: string; files: AttachmentPickerFile[]; attachedFileIds?: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(attachDriveFileAction, {});
  const targetLabel = DRIVE_ATTACHMENT_TARGETS.find((target) => target.value === targetType)?.label ?? "module";
  return <div className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="text-sm font-semibold text-ink">Attach from Drive Lite</p><p className="mt-1 text-xs text-[#667878]">Reusable picker for {targetLabel} records.</p><form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="workspaceId" value={workspaceId} /><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} /><select name="fileId" defaultValue="" className="focus-ring min-h-11 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-ink"><option value="">Choose a file</option>{files.filter((file) => !attachedFileIds.includes(file.id)).map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}</select><SubmitButton>Attach file</SubmitButton></form><FormMessage error={state.error} message={state.message} /></div>;
}
