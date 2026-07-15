# Elyqora Free

Elyqora Free is a single Next.js App Router application for connected productivity and operations modules. The current implementation establishes the shared foundation and the first product module: Identity and Workspaces.

## Current scope

The Identity and Workspaces module includes:

- Supabase password registration, sign-in, sign-out, password reset, and password update flows.
- Profile editing with locally generated avatar initials.
- Multi-tenant workspace creation, workspace type selection, switching, renaming, and soft deletion.
- Owner, admin, member, and viewer roles backed by reusable permission keys.
- Workspace invitations as copyable, expiring links or tokens. Elyqora does not send invitation email.
- RLS-protected profiles, workspaces, memberships, roles, permissions, membership statuses, invitations, and audit events.
- Audit events for workspace creation, rename, role change, member removal, invitation acceptance, and workspace deletion.
- Responsive Hub, settings, members, onboarding, and invitation screens.
- Drive Lite for small private workspace files: nested folders, bounded uploads, safe previews, signed downloads, favorites, sharing, soft deletion, restore, recycle-bin cleanup, and reusable attachment targets for Docs, Expenses, Projects, Helpdesk, and Contacts.
- Drive Lite stores metadata in PostgreSQL and content in the private `elyqora-drive` Supabase Storage bucket. The default limit is 10 MB per file and 100 MB per workspace; owners and admins can adjust those limits within the safe maximum.
- Docs is a Markdown-first document system with folders, safe preview mode, debounced drafts, manual version saves, version restoration, comments and mentions, tags, favorites, workspace sharing, explicit public publishing, full-text search metadata, and Drive Lite attachment targets. It intentionally does not attempt realtime simultaneous editing.

The remaining modules are registered in `lib/modules/registry.ts` and remain disabled until their own implementation prompts are executed. Hub, Drive Lite, and Docs are the enabled workspace modules. The Hub and shell read that registry for desktop navigation, mobile navigation, the command palette, the module launcher, and enabled-module cards.

The Hub support migration is `supabase/migrations/20260715000001_hub.sql`. It adds bounded, user-scoped recent items, pinned modules, dashboard preferences, and notifications. New workspaces receive a small initial dashboard seed; existing workspaces can receive the same seed by running `supabase/seed.sql` again.

Drive Lite is added by `supabase/migrations/20260715000002_drive_lite.sql`. It creates the private storage bucket, Drive metadata tables, file-level RLS, storage policies, quota functions, Drive permissions, and soft-delete support. Run `npm run seed:drive` with a server-only Supabase service-role or secret key to upload the sample `supabase/seed-assets/elyqora-welcome.txt` into each active workspace. Never expose that key as a `NEXT_PUBLIC_*` variable or add it to browser code.

Docs is added by `supabase/migrations/20260715000003_docs.sql`. It creates normalized document, folder, version, tag, comment, mention, link, favorite, and share tables with workspace RLS. Public routes read only the explicitly published snapshot through the `get_public_document` function, so autosaved drafts cannot appear at a public URL. Apply the migration before using `/docs`; rerun `supabase/seed.sql` to add the welcome folder and document to existing workspaces.

## Registering a new module in the Hub

To add a future module:

1. Add one `ModuleDefinition` record to `lib/modules/registry.ts` with a unique slug, icon, description, navigation group, required permission, and `enabled: true` when the module is ready.
2. Add its route using `getModuleHref` conventions. Do not add separate hardcoded links to the shell, mobile menu, launcher, or command palette.
3. Add the module’s database migration, workspace RLS policies, server actions, bounded list queries, loading/empty/error states, seed data, and tests.
4. Add the module permission to `lib/types.ts`, `lib/permissions.ts`, and `supabase/seed.sql` if it requires a new access boundary.
5. Use `TrackedLink` for important module/entity opens so the Hub’s recent-items list stays useful.
6. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before enabling the module.

For file-bearing modules, use the reusable `AttachmentPicker` and `drive_attachments` target records instead of duplicating upload logic.

For Docs specifically, link records using the normalized `document_links` table and keep Markdown as the canonical content format. Large or binary content belongs in Drive Lite, not in the document row. Public documents are served by `get_public_document` from their published snapshot; the working draft is never exposed by that route.

## Local setup

Requirements: Node.js 20+, npm, and a Supabase project.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the browser-safe anon/publishable key. Never use a service-role key here.
- `NEXT_PUBLIC_SITE_URL`: the deployed or local site URL used by password reset links.

## Supabase setup

Run the SQL in this order using the Supabase SQL editor or the Supabase CLI:

```bash
supabase db reset
```

The migrations are in `supabase/migrations/20260715000000_identity_workspaces.sql`, `supabase/migrations/20260715000001_hub.sql`, `supabase/migrations/20260715000002_drive_lite.sql`, and `supabase/migrations/20260715000003_docs.sql`; seed data is in `supabase/seed.sql`. Run `npm run seed:drive` after the database migration when you want the sample file content in Storage.

For hosted Supabase, apply the migration and seed SQL through the project’s database workflow. Make sure email confirmation and password reset redirect URLs include:

- `http://localhost:3000/auth/reset-password`
- `https://your-domain.example/auth/reset-password`

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

The browser smoke test only verifies the health route and public sign-in screen. Full account and RLS verification requires a configured Supabase project and test users.

## Security conventions

Every tenant-owned table uses `workspace_id` and RLS. Server actions validate input with Zod and re-check the authenticated user, membership, permission, and ownership boundary. Important writes go through security-definer functions or RLS-protected mutations. Workspace deletion is a soft-delete operation. Supabase service-role credentials are not referenced by the application.

## Deployment

Deploy the single Next.js application to Vercel. Add the three public environment variables in the Vercel project settings, run all Supabase migrations before inviting users, and configure Supabase Auth redirect URLs for the production domain. The optional `seed:drive` script needs a server-only Supabase secret only when run from a trusted local or CI environment; it is not required as a Vercel runtime variable. Render is not required for the critical request path.
