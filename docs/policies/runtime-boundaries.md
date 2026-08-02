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
- Schemas are strict by default. Unknown fields are rejected unless the field is
  explicitly an opaque extension payload.
- Keep actor, owner, moderator/admin authority, destination, correlation, and
  retry identity explicit at mutation boundaries.
- A caller should only read or mutate records it owns unless cross-owner access
  is the feature being implemented and is checked at the boundary.
- Missing required context is an error. Do not infer authority or ownership from
  nearby records, display names, previous requests, or synthetic sentinel
  values.
- Validate untrusted provider payloads at ingress. Once Peated signs, persists,
  or dispatches canonical context, downstream readers should assert that exact
  context rather than silently normalize or repair it.
- Retryable and resumable workflows must preserve identity and idempotency
  context across retries and continuation slices.
- Keep platform clients and SDK details inside the layer that owns them. Expose
  narrow capability functions such as `queue`, `store`, `dispatch`, or `verify`
  rather than raw clients.
- Model and tool inputs must not supply privileged actor, owner, credential, or
  durable runtime context when the runtime can derive it from authenticated
  state.
- Require deterministic idempotency or uniqueness for APIs that create durable
  records from retryable contexts.
- Validate model or agent output before persistence. Model output may propose;
  code owns permissions, identity, and irreversible state changes.
- Any value needed after an async, tool, resume, or delivery boundary must be
  represented by durable state or a persisted handle before success is
  reported. In-memory values are caches only.

## Exceptions

- One-time migrations may repair legacy malformed state, but the migration must
  be named, bounded, and verified separately from normal runtime reads.
- Opaque provider payloads may remain permissive when they are not used for
  routing, authorization, credentials, locks, or side effects.
