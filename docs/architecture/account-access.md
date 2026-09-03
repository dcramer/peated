# Account Access

This document records the rules for sign-in, Terms of Service acceptance, and
email verification. Middleware, route schemas, and tests define exact behavior.

## Terms Of Service

`users.termsAcceptedAt` records acceptance. A null value means the user has not
accepted the current required terms.

- Email/password and new-passkey registration require explicit acceptance.
- Google and magic-link authentication may establish a session for an existing
  account that has not accepted the terms. Passkey authentication requires
  acceptance before it creates a session.
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

## Authentication Safeguards

Sign-in, registration, and recovery routes share a limit of 15 requests per
hour per signed-in user or IP address. Redis stores the request count. If that
count cannot be checked, the request stops and the error handler reports the
failure.

Magic-link requests return the same empty success response for active,
inactive, and unknown accounts. Email delivery failures are reported internally
without changing the response. Neither the status code nor the response body
reveals whether an account exists. Response times can still differ.

Each signed token records its purpose in the JWT `aud` (audience) field.
`verifyToken` checks that purpose, the signature, and the expiration time before
returning the token's data. API requests using `Authorization: Bearer` require
an access token.
Email sign-in links, recovery links, email verification links, passkey
challenges, and proposals to create a Bottle from a photo each have a separate
purpose. Email sign-in links, recovery links, and passkey challenges expire
after 10 minutes; access tokens expire after 7 days.

Tokens without a purpose are rejected. When this check is first deployed,
users must sign in again and request new emailed links.

## Ownership

- user fields: `apps/server/src/db/schema/users.ts`
- token signing and verification: `apps/server/src/lib/auth.ts`
- authentication middleware: `apps/server/src/orpc/middleware/auth.ts`
- acceptance route: `apps/server/src/orpc/routes/auth/tos/accept.ts`
- registration and authentication: `apps/server/src/orpc/routes/auth/`
- web acceptance prompts: `apps/web/src/components/pendingTosAlert.tsx` and the
  ToS-required authentication page

When changing this policy, update the owning middleware and representative
integration tests in the same change. Test fixtures may default to an accepted,
verified user; policy tests should override those fields explicitly.
