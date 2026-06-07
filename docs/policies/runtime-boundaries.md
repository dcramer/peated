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
- Require deterministic idempotency or uniqueness for APIs that create durable
  records from retryable contexts.
- Validate model or agent output before persistence. Model output may propose;
  code owns permissions, identity, and irreversible state changes.

## Exceptions

- One-time migrations may repair legacy malformed state, but the migration must
  be named, bounded, and verified separately from normal runtime reads.
- Opaque provider payloads may remain permissive when they are not used for
  routing, authorization, credentials, locks, or side effects.
