# Identity and Workspaces implementation notes

## Request boundary

The application uses Supabase Auth for identity and the browser-safe Supabase SSR client for database requests. No service-role key is included in the Next.js runtime. `middleware.ts` refreshes auth cookies, while server actions perform the authorization checks immediately before mutations.

## Tenant boundary

The tenant boundary is `workspace_id`. A membership is active only when its status is `active` and the workspace is not soft-deleted. The SQL helpers `is_workspace_member` and `has_workspace_permission` run as security-definer functions and are reused by RLS policies and server-side permission helpers.

## Permission model

Roles are system records: `owner`, `admin`, `member`, and `viewer`. Permissions are named keys such as `members.manage` and `workspace.delete`, joined through `role_permissions`. The local `lib/permissions.ts` map is intended for predictable UI decisions; the database function remains authoritative for protected writes.

## Invitation model

Invitation links contain a random token only in the URL. The database stores a SHA-256 hash and a short preview for operators. Links expire after seven days, can be revoked, and are accepted only by an authenticated user. An optional invitation email is checked against the signed-in account, but Elyqora does not send email.

## Verification checklist

With a configured Supabase project, verify with two test accounts:

1. Account A creates Workspace A and sees its owner membership.
2. Account A creates a member invitation.
3. Account B accepts the link and can see Workspace A only after acceptance.
4. Account B cannot select or mutate Workspace C because membership queries and RLS policies reject the request.
5. Account A changes Account B’s role and removes Account B; audit events are created for both changes.
6. Account A deletes the workspace only after exact-name confirmation; the workspace is soft-deleted and no longer appears in active membership queries.
