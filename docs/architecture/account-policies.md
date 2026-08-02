# Account Access Policy

This document records the product decisions for OAuth access, Terms of Service
acceptance, and email verification. Middleware, route schemas, and tests define
the exact implemented coverage.

## OAuth Public Clients

Peated supports a narrow OAuth authorization-code flow for local and other
public clients. OAuth clients are system-wide records created and managed only
by Peated administrators under `/admin/oauth-clients`; there is no public or
dynamic registration endpoint and clients do not receive secrets.

The supported flow requires PKCE `S256` and an administrator-registered
redirect URI. Authorization happens at `https://peated.com/oauth/authorize`
using the existing Peated browser session. Short-lived authorization codes are
stored only as digests, expire after two minutes, and can be exchanged once at
`POST https://api.peated.com/oauth/token`.

Successful exchange returns the same seven-day bearer JWT used by existing
Peated login. It receives no additional permissions: API requests still reload
the current user and use the existing active-user, ToS, verification,
moderator, and administrator checks. Deactivating a client stops new
authorizations and exchanges but does not revoke bearer tokens already issued;
users reauthorize when the seven-day token expires.

This baseline does not implement refresh tokens, durable grants, per-client
token revocation, scopes, discovery metadata, dynamic registration, client
secrets, device authorization, or OpenID Connect.

## Terms Of Service

`users.termsAcceptedAt` records acceptance. A null value means the user has not
accepted the current required terms.

- Email/password and new-passkey registration require explicit acceptance.
- Google, magic-link, and passkey authentication may establish a session for an
  existing account that has not accepted the terms.
- Such an account remains read-only until acceptance. Browsing and account
  recovery stay available, while user-authored writes are rejected.
- The authenticated ToS acceptance route records acceptance once; clients do
  not set `termsAcceptedAt` directly.
- The web app must show a clear acceptance path when an authenticated user is
  read-only for this reason.

User-authored write routes use `requireTosAccepted` after authentication. Do not
maintain a route inventory here: new writes must make the requirement explicit
at their route boundary, and integration tests should prove the important
allowed and rejected cases.

Administrative or recovery operations may use a different boundary when their
authority and purpose are explicit. Authentication alone never implies ToS
acceptance.

## Email Verification

`users.verified` records verified-email state.

Verification is encouraged but is not a universal read or write gate. Operations
that need stronger account assurance use `requireVerified` explicitly in
addition to their other authorization middleware. The UI may prompt unverified
users without presenting verification as a requirement for operations that do
not enforce it.

## Ownership

- user fields: `apps/server/src/db/schema/users.ts`
- authentication middleware: `apps/server/src/orpc/middleware/auth.ts`
- acceptance route: `apps/server/src/orpc/routes/auth/tos/accept.ts`
- registration and authentication: `apps/server/src/orpc/routes/auth/`
- web acceptance prompts: `apps/web/src/components/pendingTosAlert.tsx` and the
  ToS-required authentication page

When changing this policy, update the owning middleware and representative
integration tests in the same change. Test fixtures may default to an accepted,
verified user; policy tests should override those fields explicitly.
