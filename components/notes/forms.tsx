"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/auth/submit-button";
import { createNoteAction, restoreNoteAction } from "@/lib/actions/notes";
import { NOTE_COLORS, NOTE_SCOPES, NOTE_VISIBILITIES } from "@/lib/notes/constants";
import type { ActionState } from "@/lib/actions/types";

export function CreateNoteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createNoteAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-semibold text-[#667878]">
          Title
          <Input name="title" placeholder="Quick note title" className="mt-1" />
        </label>
        <label className="block text-xs font-semibold text-[#667878]">
          Color
          <Select name="color" defaultValue="mint" className="mt-1">
            {NOTE_COLORS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
          </Select>
        </label>
      </div>
      <label className="block text-xs font-semibold text-[#667878]">
        Body
        <Textarea name="bodyMd" placeholder="Write in Markdown…" className="mt-1 min-h-40" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-semibold text-[#667878]">
          Scope
          <Select name="scope" defaultValue="personal" className="mt-1">
            {NOTE_SCOPES.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
          </Select>
        </label>
        <label className="block text-xs font-semibold text-[#667878]">
          Visibility
          <Select name="visibility" defaultValue="private" className="mt-1">
            {NOTE_VISIBILITIES.map((visibility) => <option key={visibility.value} value={visibility.value}>{visibility.label}</option>)}
          </Select>
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-[#667878]">
        <input type="checkbox" name="pinned" value="true" />
        Pin this note
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Creating…">Create note</SubmitButton>
        <p className="text-xs leading-5 text-[#8a9992]">Personal notes stay private; workspace notes can be shared by role and visibility.</p>
      </div>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}

export function RestoreNoteForm({ noteId, children = "Restore note" }: { noteId: string; children?: ReactNode }) {
  const [state, action] = useActionState<ActionState, FormData>(restoreNoteAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="noteId" value={noteId} />
      <Button type="submit" variant="secondary" className="min-h-9 text-xs">
        {children}
      </Button>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}
