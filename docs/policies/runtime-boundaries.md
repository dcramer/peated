# Runtime Boundaries

## Intent

Data that crosses API, queue, storage, AI, callback, or durable-state boundaries
should be parsed, authorized, and owned explicitly instead of relying on nearby
TypeScript assumptions.

## Policy

- Boundary contracts should have one owning runtime schema or route input schema
  that also owns the exported TypeScript type.
- Parsers at external or durable boundaries should accept `unknown` and return
  parsed output types. Downstream runtime code should receive parsed data.
- Keep actor, owner, moderator/admin authority, destination, and retry identity
  explicit at mutation boundaries.
- A caller should only read or mutate records it owns unless cross-owner access
  is the feature being implemented and is checked at the boundary.
- Keep platform clients and SDK details inside the layer that owns them. Expose
  narrow capability functions such as `queue`, `store`, `dispatch`, or `verify`
  rather than raw clients.
- AI agent runs should always own an observability conversation id. Prefer a
  durable entity id with a stable domain prefix; when no durable id exists,
  generate a run-scoped UUID instead of using names or other fuzzy identifiers.
- Tests for SDK-owned scope or context behavior should spy on the real SDK
  surface, such as exported functions, logger methods, scope instances, or
  prototypes. Do not whole-module mock observability clients such as Sentry;
  whole-module mocks erase the runtime state the integration is meant to
  protect.
- Observability tests should stay minimal: assert the existence of the span,
  operation, conversation id, and a few critical safe attributes. Do not snapshot
  broad telemetry payloads or duplicate provider SDK behavior in unit tests.
- Require deterministic idempotency or uniqueness for APIs that create durable
  records from retryable contexts.
- Validate model or agent output before persistence. Model output may propose;
  code owns permissions, identity, and irreversible state changes.
- Persist agent proposals separately from server-owned review state. Review
  state may add a live preview, bounded impact, warnings, a narrow state token,
  status, reviewer, and execution result; those fields must never be accepted
  from the model.
- Prepare proposals independently so a mechanical failure is retained as a
  blocked review operation without discarding valid siblings.
- Approval must revalidate the fields and relationships covered by the state
  token. Relevant drift becomes stale without mutation; unrelated timestamps
  must not invalidate an operation.
- Retry only failed operations under the same durable operation id, and
  reconcile a prior attempt before redispatch. Blocked or stale work requires a
  new check or manual correction, and a closed parent check is immutable.

## Exceptions

- One-time migrations may repair legacy malformed state, but the migration must
  be named, bounded, and verified separately from normal runtime reads.
- Opaque provider payloads may remain permissive when they are not used for
  routing, authorization, credentials, locks, or side effects.
