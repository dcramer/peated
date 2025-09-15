# Account Policies: Terms of Service (ToS) and Email Verification

This doc explains how ToS acceptance and email verification work across the API and web app, what they gate, and where to change behavior.

## Data model

- `users.tosAcceptedAt: timestamp | null` — set when a user agrees to the Terms of Service. `NULL` means not accepted.
- `users.verified: boolean` — email address verified state.

Schema: `apps/server/src/db/schema/users.ts`

## API surface

- Register: `POST /rpc/auth/register`

  - Input includes `tosAccepted: boolean` — required. If false/missing, returns 422.
  - On success sets `users.tosAcceptedAt = NOW()`.

- Login (Google): `POST /rpc/auth/login` (code or idToken)

  - Input accepts optional `tosAccepted: boolean`.
  - Behavior:
    - Existing Google user without `tosAcceptedAt`: requires `tosAccepted=true` and will set `tosAcceptedAt`.
    - New Google user: refuses to create unless `tosAccepted=true`.

- Accept ToS: `POST /rpc/auth/tos/accept`

  - Auth required. Sets `users.tosAcceptedAt = NOW()` and returns updated user.

- Email verification:
  - `POST /rpc/email/verify` — verifies token from email.
  - `POST /rpc/email/resend-verification` — resends verification email.

## Server enforcement

Currently, the server does NOT hard‑gate API access for users without ToS acceptance. Enforcement is done via UI flows (signup checkbox, Google interstitial, post‑login redirect to `/tos`) and banners.

If we need stricter enforcement later, we can add a small oRPC middleware in `apps/server/src/orpc/index.ts` to block most RPCs for users missing `tosAcceptedAt`, with an allowlist for `auth` and `email` routes.

## Web behavior and flows

### 1) Email/password registration

1. Register form includes a required checkbox. The client passes `tosAccepted=true`.
2. Server validates and sets `tosAcceptedAt`.
3. New users are created with `verified=false` (unless configured to skip) and are redirected to `/verify` (existing flow).

UI code: `apps/web/src/components/registerForm.tsx`, action in `apps/web/src/lib/auth.actions.ts`.

### 2) Google sign in/up

1. We show an interstitial modal that requires accepting ToS before triggering Google.
2. The client includes `tosAccepted=true` in the subsequent `/auth/login` call.
3. Server enforces acceptance for both existing and new Google users.

UI code: `apps/web/src/components/googleLoginButton.tsx`.

### 3) Existing users without ToS (backfill case)

1. After a successful login, `authenticate()` checks `user.tosAcceptedAt`.
2. If missing, it redirects to `/tos?redirectTo=…` where the user can Accept or Log out.
3. Until accepted, the server middleware blocks most API calls (even if the UI tries), while `auth`/`email` routes remain usable.

UI code: `/tos` page at `apps/web/src/app/(layout-free)/tos/page.tsx`.

### 4) Banners (“nag”)

- To mirror “pending verification,” we display a thin banner when logged‑in and ToS is not accepted:
  - `PendingTosAlert`: `apps/web/src/components/pendingTosAlert.tsx`.
  - Added to: `apps/web/src/app/(default)/(activity)/layout.tsx` and settings page.
- The existing `PendingVerificationAlert` remains for the email flow.

## User experience summary

- You cannot fully log in without accepting ToS:
  - Email signup requires a checkbox.
  - Google flow requires pre‑acceptance and the server enforces it.
  - Existing accounts are redirected to `/tos` post‑login, and most API calls are blocked via middleware until acceptance.
- Email verification is still encouraged but not hard‑blocked:
  - Banner prompts to verify; app continues to work.

## Limitations and configuration

- Allowlist scope: Adjust in `tosGateMiddleware()` if some read‑only modules (e.g., `search`, `version`, `stats`) should be available pre‑acceptance.
- ToS link target: UI links point to `https://peated.com/terms`. The static in‑app `/terms` page was removed in favor of the canonical URL.
- Tests: default fixtures set `tosAcceptedAt` to avoid breaking unrelated tests. Create targeted tests with `tosAcceptedAt: null` when needed.

## How to test locally

1. Run server migrations to add `tos_accepted_at`.
2. Create a user with `tosAcceptedAt = null` (override the fixture default) and log in.
3. Observe redirect to `/tos` and that typical RPCs (e.g., bottles, tastings) return `FORBIDDEN` until acceptance.
4. Hit `Accept and continue` on `/tos`, verify the session refreshes and normal navigation/API usage resumes.
5. For Google, test that the modal requires acceptance before proceeding and that the server accepts with `tosAccepted=true`.
