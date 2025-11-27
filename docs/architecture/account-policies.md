# Account Policies: Terms of Service (ToS) and Email Verification

This doc explains how ToS acceptance and email verification work across the API and web app, what they gate, and where to change behavior.

## Data model

- `users.termsAcceptedAt: timestamp | null` — set when a user agrees to the Terms of Service. `NULL` means not accepted.
- `users.verified: boolean` — email address verified state.

Schema: `apps/server/src/db/schema/users.ts`

## API surface

- Register: `POST /rpc/auth/register`

  - Input includes `tosAccepted: boolean` — required. If false/missing, returns 422.
  - On success sets `users.termsAcceptedAt = NOW()`.

- Login (Google): `POST /rpc/auth/login` (code or idToken)

  - Input accepts optional `tosAccepted: boolean`.
  - Google OAuth does NOT require ToS acceptance at login time.
  - If `tosAccepted=true` is provided, sets `termsAcceptedAt`.
  - Users can sign in/up via Google without accepting ToS (read-only access until accepted).

- Accept ToS: `POST /rpc/auth/tos/accept`

  - Auth required. Sets `users.termsAcceptedAt = NOW()` and returns updated user.

- Email verification:
  - `POST /rpc/email/verify` — verifies token from email.
  - `POST /rpc/email/resend-verification` — resends verification email.

## Server enforcement

### Write operation gating (requireTosAccepted middleware)

All user write operations require ToS acceptance. The `requireTosAccepted` middleware in `apps/server/src/orpc/middleware/auth.ts` returns FORBIDDEN (403) with message "You must accept the Terms of Service to perform this action." if `user.termsAcceptedAt` is null.

**Routes using requireTosAccepted:**

User content operations:

- `tastings/create.ts`, `tastings/update.ts`, `tastings/delete.ts`
- `tastings/image-update.ts`, `tastings/image-delete.ts`
- `comments/create.ts`, `comments/delete.ts`
- `collections/bottles/create.ts`, `collections/bottles/delete.ts`
- `friends/create.ts`, `friends/delete.ts`
- `flights/create.ts`, `flights/update.ts`
- `users/update.ts`

**Exempt from ToS check:**

- All GET/list/details routes (read-only)
- All `/auth/*` routes
- Admin-only operations (use requireAdmin instead)

### Adding ToS enforcement to new routes

When creating a new write operation route, add the middleware after `requireAuth`:

```typescript
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";

export default procedure.use(requireAuth).use(requireTosAccepted).route({
  method: "POST",
  // ...
});
```

### Authentication edge enforcement

- Register requires `tosAccepted=true` and sets `termsAcceptedAt`.
- Google OAuth does NOT require ToS at login (allows nag-based acceptance flow).

## Web behavior and flows

### 1) Email/password registration

1. Register form includes a required checkbox. The client passes `tosAccepted=true`.
2. Server validates and sets `termsAcceptedAt`.
3. New users are created with `verified=false` (unless configured to skip) and are redirected to `/verify` (existing flow).

UI code: `apps/web/src/components/registerForm.tsx`, action in `apps/web/src/lib/auth.actions.ts`.

### 2) Google sign in/up

1. User clicks "Sign in with Google" — no ToS checkbox required.
2. Google OAuth proceeds immediately.
3. User is logged in but may not have accepted ToS yet.
4. User has read-only access until they accept ToS via the nag banner.

UI code: `apps/web/src/components/googleLoginButton.tsx`.

### 3) Existing users without ToS (backfill case)

1. User logs in normally.
2. The `PendingTosAlert` banner prompts acceptance.
3. User can browse (read-only) but cannot create content until they accept.
4. Write API calls return 403 until ToS is accepted.

### 4) Banners ("nag")

- `PendingTosAlert`: `apps/web/src/components/pendingTosAlert.tsx`.
- Added to: `apps/web/src/app/(default)/(activity)/layout.tsx` and settings page.
- Shows "Accept Now" and "Review Terms" buttons.
- The existing `PendingVerificationAlert` remains for the email flow.

## User experience summary

- **Email signup**: Requires ToS checkbox (server enforced at registration).
- **Google OAuth**: No ToS required to sign in. Users get read-only access until they accept via the nag banner.
- **Read-only until accepted**: Users can browse content but cannot create tastings, comments, collections, etc.
- **Email verification**: Encouraged but not hard-blocked; banner prompts to verify.

## Limitations and configuration

- ToS link target: UI links use the relative path `/terms` to work in all environments (dev/staging/prod). The in-app static Terms page lives at `apps/web/src/app/(layout-free)/terms/page.tsx` and includes an Effective Date.
- Tests: default fixtures set `termsAcceptedAt` to avoid breaking unrelated tests. Create targeted tests with `termsAcceptedAt: null` when needed.

## How to test locally

1. Create a user with `termsAcceptedAt = null` (override the fixture default) and log in via Google.
2. Verify user can browse content but cannot create a tasting (should get 403).
3. Use the PendingTosAlert banner to accept ToS.
4. Verify write operations now work.
