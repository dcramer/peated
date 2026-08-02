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
- Persist durable work state before starting background execution.
- Make queued work idempotent. Use stable idempotency keys, unique jobs, durable
  state, or database constraints when retries can schedule the same logical work
  more than once.
- Queue and callback payloads should carry small validated envelopes such as ids
  and expected versions. Store full work payloads in the owning durable state.
- Bound attempts, age, and continuation depth. Define explicit recovery for
  stale non-terminal states and reconcile a prior attempt before redispatch.
- Use durable leases or locks when concurrent workers may claim the same work.
  Define ownership and lock ordering when a job touches multiple state domains.
- Log post-save side-effect failures with enough object context to retry or
  investigate without failing an already persisted save.
- Work that performs an authoritative mutation remains non-terminal until the
  worker records the mutation result or a safe failure.
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
