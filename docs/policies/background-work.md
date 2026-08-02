# Background Work

## Intent

User-visible save requests should finish after the authoritative change is
persisted, not after every slow verification, indexing, or external side effect
has completed.

## Policy

- Persist the durable product change before dispatching post-save work.
- Keep AI review, catalog verification, indexing, email, search-vector refresh,
  and other slow side effects out of the blocking request path when a queued or
  follow-up path can preserve correctness.
- Make queued work idempotent. Use unique jobs, durable state, or database
  constraints when retries can schedule the same logical work more than once.
- Log post-save side-effect failures with enough object context to retry or
  investigate without failing an already persisted save.
- A post-user-creation Bottle check runs only after the Bottle transaction
  commits. Key it to the Bottle-creation event so queue retries cannot create a
  duplicate actionable check, and never auto-apply its supplemental proposed
  operations.
- Persist moderator approval before dispatching a review operation. Reuse its
  durable operation id for at-most-once dispatch and reconciliation.
- Asynchronous canonical work, including Entity merge, remains `applying` until
  the worker records an authoritative mutation result or a safe failure.
- Use database constraints, aliases, or other deterministic checks for immediate
  duplicate safety. Do not depend on a remote classifier or hosted service for
  request-path correctness.
- For uploads, keep the server-side processing path authoritative for final
  dimensions, encoding, and quality. Client resizing is only a latency guard.
- Avoid extra external-storage handshakes for small processed uploads when they
  make save latency worse without improving durability.

## Exceptions

- Authorization, validation, deterministic normalization, and required database
  writes stay in the request path.
- User flows that intentionally wait for an external result must show progress
  and handle retry or partial success explicitly.
