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
- Persist work state before execution when the job must resume after queue state
  is lost or replaced.
- Make queued work idempotent. Use stable idempotency keys, unique jobs, durable
  state, or database constraints when retries can schedule the same logical work
  more than once.
- Queue and callback arguments should contain only small values such as IDs and
  expected versions. New or changed handlers must check their arguments at the
  start. Store full work input in the database record that owns it.
- Bound attempts, age, and continuation depth. For resumable work, define how to
  recover stale state and check a prior attempt before dispatching it again.
- Use durable leases or locks when concurrent workers can claim the same saved
  work. Define lock order when one job changes several records.
- Log post-save side-effect failures with enough object context to retry or
  investigate without failing an already persisted save.
- A resumable workflow that changes authoritative data is not complete until it
  records the result or a safe failure.
- Use database constraints, aliases, or other deterministic checks for immediate
  duplicate safety. Do not depend on a remote model or hosted service for
  request-path correctness.
- Stored user-authored input remains untrusted content when processed later by a
  system worker.

## Exceptions

- Authorization, validation, deterministic normalization, and required database
  writes stay in the request path.
- User flows that intentionally wait for an external result must show progress
  and handle retry or partial success explicitly.
- Purely best-effort telemetry or cache warming may skip durable state when
  losing the work has no product effect.
