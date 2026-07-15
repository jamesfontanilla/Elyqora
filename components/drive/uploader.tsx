"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { DRIVE_ALLOWED_MIME_TYPES } from "@/lib/drive/constants";

export function DriveUploader({ workspaceId, folderId }: { workspaceId: string; folderId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "complete" | "error">("idle");
  const [message, setMessage] = useState("");

  function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState("error");
      setMessage("Choose a file first.");
      return;
    }
    setState("uploading");
    setMessage("Uploading securely…");
    setProgress(4);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/drive/upload");
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.max(5, Math.min(90, Math.round((event.loaded / event.total) * 90))));
    };
    request.onload = () => {
      let response: { error?: string } = {};
      try { response = JSON.parse(request.responseText) as { error?: string }; } catch { /* The server returned a non-JSON error. */ }
      if (request.status >= 200 && request.status < 300) {
        setProgress(100);
        setState("complete");
        setMessage("File uploaded. Refreshing your folder…");
        window.setTimeout(() => window.location.reload(), 500);
      } else {
        setState("error");
        setMessage(response.error ?? "The upload could not be completed.");
        setProgress(0);
      }
    };
    request.onerror = () => {
      setState("error");
      setMessage("The upload connection was interrupted.");
      setProgress(0);
    };
    const formData = new FormData();
    formData.append("workspaceId", workspaceId);
    if (folderId) formData.append("folderId", folderId);
    formData.append("file", file);
    request.send(formData);
  }

  return <div className="space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><input ref={inputRef} type="file" accept={DRIVE_ALLOWED_MIME_TYPES.join(",")} className="focus-ring min-h-11 w-full rounded-xl border border-dashed border-[var(--line)] bg-sand/40 px-3 py-2 text-sm text-[#667878] file:mr-3 file:rounded-lg file:border-0 file:bg-mint file:px-3 file:py-2 file:text-xs file:font-semibold file:text-moss" /><Button type="button" onClick={upload} disabled={state === "uploading"}><UploadCloud size={16} className="mr-2" />{state === "uploading" ? "Uploading…" : "Upload file"}</Button></div>{state !== "idle" && <div className="space-y-2"><div className="h-2 overflow-hidden rounded-full bg-sand"><div className={`h-full rounded-full transition-all ${state === "error" ? "bg-coral" : "bg-moss"}`} style={{ width: `${progress}%` }} /></div><FormMessage error={state === "error" ? message : undefined} message={state !== "error" ? message : undefined} /></div>}<p className="text-xs leading-5 text-[#8a9992]">Small files only. Videos, archives, executables, and public uploads are not supported.</p></div>;
}
