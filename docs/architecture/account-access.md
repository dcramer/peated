# Account Access

This document records the rules for sign-in, Terms of Service acceptance, and
email verification. Middleware, route schemas, and tests define exact behavior.

## Terms Of Service

`users.termsAcceptedAt` records acceptance. A null value means the user has not
accepted the current required terms.

- Email/password and new-passkey registration require explicit acceptance.
- Google, Apple, and magic-link authentication may establish a session for an
  existing account that has not accepted the terms. Passkey authentication requires
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

## Third-Party Sign-In

Google and Apple sign-in link an external identity to a user by the provider's
stable subject ID, stored in `identities`.

- A token whose email matches an existing account links to that account only
  when both the account and the provider email are verified.
- Otherwise a new account is created. It is verified when the provider says
  the email is. The username comes from the email's local part. Apple sends
  the user's name only on the first sign-in, and hidden emails are random
  relay addresses, so an Apple name is used first.
- Apple identity tokens are verified against Apple's published keys. Accepted
  audiences default to the iOS bundle ID; `APPLE_CLIENT_IDS` overrides them.
  Tokens older than five minutes are rejected.

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

## Account Deletion

Members delete their own accounts with `DELETE /users/me`. The route needs
authentication only, so a member who has not accepted the current terms can
still delete their account. Nobody can delete another member's account through
it. App Store Review Guideline 5.1.1(v) requires this in-app path.

### Grace period

A request does not delete anything at once. It records
`users.deletionRequestedAt`, emails the member a confirmation with the
deletion time and how to cancel, and returns the member with
`deletionScheduledAt` set 24 hours out. The account keeps working until then,
and `deletionScheduledAt` is shown only to the member so clients can display
a notice. `DELETE /users/me/deletion` cancels the request. Repeating the
request or the cancellation changes nothing.

The worker runs `ProcessAccountDeletions` hourly. It deletes every account
whose request is at least 24 hours old, checking the request again under a
row lock so a cancellation that lands in between wins.

### What deletion does

Deletion keeps the public record and removes the person. It happens in one
transaction:

- Catalog contributions stay. Bottles, Entities, and their change history keep
  the member's actor row, with the display name replaced and the picture
  removed.
- The user row stays as a tombstone. `deletedAt` is set, `active` is false,
  and the username, email, password, and picture are replaced so the old
  values can be used again. Access tokens stop working because the account is
  inactive. Deleted members do not appear in profile pages, member lists, or
  search.
- The member's tastings and member reviews stay as removed rows with the
  reason `Account deleted`, the same way moderated content is hidden. Content
  a moderator already removed keeps its original removal record. Their images
  are removed.
- Everything else the member owns is deleted: comments and toasts left on
  tastings (with counters adjusted), collections, flights, follows, badge
  awards, notifications, pending uploads, sign-in identities, passkeys, and
  OAuth grants. Friend tags naming the member are cleared from other members'
  tastings and reviews. Other members' tastings that used one of the member's
  flights keep the tasting and lose the flight link.
- Staff references without a database rule (Bottle observations, store-price
  reviews and retry runs, and site scrape requests) are cleared.

After the commit, uploaded images are removed from storage and Bottle
summaries are recomputed in the background. A storage failure is reported and
does not undo the deletion.

### Sign in with Apple

Apple requires revoking the member's Sign in with Apple grant when the account
is deleted. The client sends a fresh `appleAuthorizationCode` from a new Sign
in with Apple prompt with the deletion request. The code lives five minutes,
so the server exchanges it for tokens and revokes them at request time, before
anything is scheduled. A failure schedules nothing and the client retries with
a new code. A member who cancels afterwards signs in with Apple again, which
creates a new grant.

Deletion never depends on Apple: without a code, or on a server without Apple
credentials, the deletion is still scheduled and the grant remains until the
member removes it in their Apple ID settings. Revocation needs
`APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY`, and uses the first
`APPLE_CLIENT_IDS` entry as the client ID.

## Ownership

- user fields: `apps/server/src/db/schema/users.ts`
- token signing and verification: `apps/server/src/lib/auth.ts`
- Apple identity token verification and revocation: `apps/server/src/lib/apple.ts`
- account deletion: `apps/server/src/lib/accountDeletion.ts`,
  `apps/server/src/orpc/routes/users/delete.ts`,
  `apps/server/src/orpc/routes/users/deletion-cancel.ts`, and the
  `ProcessAccountDeletions` worker job
- authentication middleware: `apps/server/src/orpc/middleware/auth.ts`
- acceptance route: `apps/server/src/orpc/routes/auth/tos/accept.ts`
- registration and authentication: `apps/server/src/orpc/routes/auth/`
- web acceptance prompts: `apps/web/src/components/pendingTosAlert.tsx` and the
  ToS-required authentication page

When changing this policy, update the owning middleware and representative
integration tests in the same change. Test fixtures may default to an accepted,
verified user; policy tests should override those fields explicitly.
