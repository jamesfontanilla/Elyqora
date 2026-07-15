import Link from "next/link";
import Image from "next/image";
import { ArrowDownToLine, ArrowUpRight, FileText, Folder, HardDrive, Image as ImageIcon, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, getMembership, hasPermission } from "@/lib/auth/guards";
import { getCurrentWorkspace } from "@/lib/workspaces/current";
import { getDriveData, getDrivePreview, getDriveWorkspaceMembers } from "@/lib/drive/queries";
import { formatBytes, DRIVE_IMAGE_MIME_TYPES } from "@/lib/drive/constants";
import { CreateFolderForm, DriveFileActions, DriveSettingsForm, FolderActions } from "@/components/drive/forms";
import { DriveUploader } from "@/components/drive/uploader";
import { RecentDriveFiles } from "@/components/drive/recent-files";

type SearchParams = Promise<{ folderId?: string; search?: string; page?: string; deleted?: string; preview?: string }>;

export default async function DriveLitePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspace = await getCurrentWorkspace(user.id);
  if (!workspace) return null;
  const params = await searchParams;
  const folderId = params.folderId && /^[0-9a-f-]{36}$/i.test(params.folderId) ? params.folderId : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = (params.search ?? "").trim().slice(0, 80);
  const includeDeleted = params.deleted === "1";
  const [drive, membership, canWrite, canManage, canUpdateStorage, members, preview] = await Promise.all([
    getDriveData({ userId: user.id, workspaceId: workspace.id, folderId, search, page, includeDeleted }),
    getMembership(workspace.id, user.id),
    hasPermission(workspace.id, "drive.write"),
    hasPermission(workspace.id, "drive.manage"),
    hasPermission(workspace.id, "workspace.update"),
    getDriveWorkspaceMembers(workspace.id),
    params.preview ? getDrivePreview(params.preview) : Promise.resolve(null),
  ]);
  const totalPages = Math.max(1, Math.ceil(drive.totalFiles / 24));
  const query = new URLSearchParams();
  if (folderId) query.set("folderId", folderId);
  if (search) query.set("search", search);
  if (includeDeleted) query.set("deleted", "1");
  const queryString = query.toString();
  const usagePercent = Math.min(100, Math.round((drive.usageBytes / Math.max(1, drive.settings.quota_bytes)) * 100));
  const pageTitle = includeDeleted ? "Recycle bin" : drive.breadcrumbs.at(-1)?.name ?? "All files";

  return <div className="space-y-8"><section className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">Workspace / Drive Lite</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Small files, safely kept.</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#667878]">A private, quota-aware home for the files your {workspace.name} workspace needs close at hand.</p></div><div className="flex flex-wrap gap-2"><Link href="/hub"><Button variant="secondary">Back to Hub</Button></Link><Link href={includeDeleted ? "/files" : "/files?deleted=1"}><Button variant="ghost">{includeDeleted ? "Active files" : "Recycle bin"}</Button></Link></div></section>

    <section className="grid gap-4 md:grid-cols-3"><Card><CardContent><div className="mb-5 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-moss"><HardDrive size={18} /></span><Badge>{membership?.role.label ?? "Member"}</Badge></div><p className="text-sm text-[#667878]">Storage used</p><p className="mt-1 text-3xl font-semibold text-ink">{formatBytes(drive.usageBytes)}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-moss" style={{ width: `${usagePercent}%` }} /></div><p className="mt-2 text-xs text-[#8a9992]">{usagePercent}% of {formatBytes(drive.settings.quota_bytes)} quota</p></CardContent></Card><Card><CardContent><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-sand text-moss"><ShieldCheck size={18} /></div><p className="text-sm text-[#667878]">Private by default</p><p className="mt-1 text-lg font-semibold text-ink">Signed links</p><p className="mt-2 text-xs leading-5 text-[#8a9992]">Downloads and previews expire quickly and require workspace access.</p></CardContent></Card><Card><CardContent><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-sand text-moss"><FileText size={18} /></div><p className="text-sm text-[#667878]">Visible in this view</p><p className="mt-1 text-3xl font-semibold text-ink">{drive.totalFiles}</p><p className="mt-2 text-xs leading-5 text-[#8a9992]">Bounded results with filename search and pagination.</p></CardContent></Card></section>

    {canWrite && !includeDeleted && <Card><CardHeader><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-moss"><ArrowUpRight size={18} /></span><div><h2 className="font-display text-2xl font-semibold text-ink">Add to {pageTitle}</h2><p className="mt-1 text-sm text-[#667878]">Uploads are validated against this workspace&apos;s file-size limit, MIME allowlist, and quota.</p></div></div></CardHeader><CardContent><DriveUploader workspaceId={workspace.id} folderId={folderId} /></CardContent></Card>}
    <RecentDriveFiles files={drive.recentFiles} visible={!includeDeleted && !search && !folderId} />

    <section className="grid gap-6 xl:grid-cols-[1fr_0.34fr]">{!includeDeleted && <Card><CardHeader><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2 text-sm text-[#667878]">{drive.breadcrumbs.map((crumb, index) => <span key={crumb.id ?? "root"} className="flex items-center gap-2">{index > 0 && <span className="text-[#b0bbb4]">/</span>}{crumb.id ? <Link href={`/files?folderId=${crumb.id}${search ? `&search=${encodeURIComponent(search)}` : ""}`} className="hover:text-moss">{crumb.name}</Link> : <Link href={search ? `/files?search=${encodeURIComponent(search)}` : "/files"} className="hover:text-moss">{crumb.name}</Link>}</span>)}</div><h2 className="mt-3 font-display text-2xl font-semibold text-ink">{pageTitle}</h2></div><form method="get" className="flex gap-2"><input type="hidden" name="folderId" value={folderId ?? ""} /><Input name="search" defaultValue={search} placeholder="Search files" aria-label="Search files" /><Button type="submit" variant="secondary" aria-label="Search"><Search size={16} /></Button></form></div></CardHeader><CardContent className="space-y-6">{canWrite && <CreateFolderForm workspaceId={workspace.id} parentId={folderId} />}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{drive.folders.map((folder) => <Card key={folder.id} className="border-[var(--line)] bg-sand/30"><CardContent className="p-4"><Link href={`/files?folderId=${folder.id}`} className="focus-ring flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-moss"><Folder size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{folder.name}</span><span className="block text-xs text-[#8a9992]">Nested folder</span></span><ArrowUpRight size={15} className="text-[#9aa8a2]" /></Link>{canWrite && <FolderActions workspaceId={workspace.id} folder={folder} />}</CardContent></Card>)}</div>{drive.folders.length === 0 && drive.files.length === 0 && <div className="rounded-2xl bg-sand/60 p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint text-moss"><Folder size={20} /></div><h3 className="mt-4 font-display text-2xl font-semibold text-ink">This folder is empty</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667878]">Create a folder or upload a small, safe file to give this workspace a useful starting point.</p></div>}{drive.files.length > 0 && <div className="divide-y divide-[var(--line)]">{drive.files.map((file) => <div key={file.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-moss">{DRIVE_IMAGE_MIME_TYPES.has(file.mime_type) ? <ImageIcon size={18} /> : <FileText size={18} />}</span><div className="min-w-0 flex-1"><Link href={`/files?${new URLSearchParams({ ...(folderId ? { folderId } : {}), ...(search ? { search } : {}), preview: file.id }).toString()}`} className="focus-ring block truncate text-sm font-semibold text-ink hover:text-moss">{file.name}</Link><p className="mt-1 text-xs text-[#8a9992]">{file.mime_type} · {formatBytes(file.size_bytes)} · {file.access_level === "restricted" ? "Restricted" : "Workspace"}</p></div><div className="flex flex-wrap items-center gap-2"><Link href={`/api/drive/download?fileId=${file.id}`} className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-semibold text-moss"><ArrowDownToLine size={14} />Download</Link><Badge className={drive.favoriteIds.includes(file.id) ? "bg-mint text-moss" : "bg-sand text-[#667878]"}>{drive.favoriteIds.includes(file.id) ? "Favorite" : "File"}</Badge></div></div>{canWrite && <DriveFileActions workspaceId={workspace.id} file={file} folders={drive.moveFolders} members={members as DriveMember[]} isFavorite={drive.favoriteIds.includes(file.id)} canManage={canManage} />}</div>)}</div>}{totalPages > 1 && <div className="flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm"><span className="text-[#667878]">Page {page} of {totalPages}</span><div className="flex gap-2">{page > 1 && <Link href={`/files?${queryWithPage(queryString, page - 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Previous</Link>}{page < totalPages && <Link href={`/files?${queryWithPage(queryString, page + 1)}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-moss">Next</Link>}</div></div>}</CardContent></Card>}
      {includeDeleted && <Card><CardHeader><h2 className="font-display text-2xl font-semibold text-ink">Deleted files</h2><p className="mt-1 text-sm text-[#667878]">Deletion is soft until an owner or admin explicitly purges the storage object.</p></CardHeader><CardContent>{drive.files.length === 0 ? <div className="rounded-xl bg-sand/60 p-5 text-sm text-[#667878]">The recycle bin is empty.</div> : <div className="divide-y divide-[var(--line)]">{drive.files.map((file) => <div key={file.id} className="py-4 first:pt-0"><div className="flex items-center gap-3"><FileText size={18} className="text-moss" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{file.name}</div><p className="text-xs text-[#8a9992]">Deleted {new Date(file.deleted_at ?? file.updated_at).toLocaleDateString()}</p></div></div><DriveFileActions workspaceId={workspace.id} file={file} folders={drive.moveFolders} members={members as DriveMember[]} isFavorite={false} canManage={canManage} /></div>)}</div>}</CardContent></Card>}</section>

    {preview && <Card><CardHeader><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Safe preview</p><h2 className="mt-2 truncate font-display text-2xl font-semibold text-ink">{preview.file.name}</h2></div><Link href={queryString ? `/files?${queryString}` : "/files"} className="text-sm font-semibold text-moss hover:underline">Close</Link></div></CardHeader><CardContent>{preview.url || DRIVE_IMAGE_MIME_TYPES.has(preview.file.mime_type) ? <Image src={preview.url ?? `/api/drive/preview?fileId=${preview.file.id}`} alt={preview.file.name} width={1200} height={800} unoptimized className="max-h-[520px] max-w-full rounded-xl border border-[var(--line)] object-contain" /> : preview.text !== null ? <pre className="max-h-[520px] overflow-auto rounded-xl bg-ink p-5 text-xs leading-6 text-mint">{preview.text}</pre> : <div className="rounded-xl bg-sand/60 p-5 text-sm text-[#667878]">This file is safe to download but does not have an in-app preview.</div>}</CardContent></Card>}

    {canUpdateStorage && <DriveSettingsForm workspaceId={workspace.id} settings={drive.settings} />}
  </div>;
}

function queryWithPage(queryString: string, page: number) {
  const params = new URLSearchParams(queryString);
  params.set("page", String(page));
  return params.toString();
}

type DriveMember = { user_id: string; profile?: { full_name?: string | null } | null };
