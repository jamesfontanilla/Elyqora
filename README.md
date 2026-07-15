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

The remaining modules are registered in `lib/modules/registry.ts` and remain disabled until their own implementation prompts are executed. The Hub reads that registry for desktop navigation, mobile navigation, the command palette, the module launcher, and enabled-module cards.

The Hub support migration is `supabase/migrations/20260715000001_hub.sql`. It adds bounded, user-scoped recent items, pinned modules, dashboard preferences, and notifications. New workspaces receive a small initial dashboard seed; existing workspaces can receive the same seed by running `supabase/seed.sql` again.

## Registering a new module in the Hub

To add a future module:

1. Add one `ModuleDefinition` record to `lib/modules/registry.ts` with a unique slug, icon, description, navigation group, required permission, and `enabled: true` when the module is ready.
2. Add its route using `getModuleHref` conventions. Do not add separate hardcoded links to the shell, mobile menu, launcher, or command palette.
3. Add the module’s database migration, workspace RLS policies, server actions, bounded list queries, loading/empty/error states, seed data, and tests.
4. Add the module permission to `lib/types.ts`, `lib/permissions.ts`, and `supabase/seed.sql` if it requires a new access boundary.
5. Use `TrackedLink` for important module/entity opens so the Hub’s recent-items list stays useful.
6. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before enabling the module.

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

The migration is in `supabase/migrations/20260715000000_identity_workspaces.sql` and seed data is in `supabase/seed.sql`.

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

Deploy the single Next.js application to Vercel. Add the three environment variables in the Vercel project settings, run the Supabase migration/seed workflow before inviting users, and configure Supabase Auth redirect URLs for the production domain. Render is not required for the critical request path.
