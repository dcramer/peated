# Data And Permission Boundaries

## Intent

Check data and permissions when data enters an API, queue, saved JSON value,
model, callback, or resumed workflow. Do not rely on TypeScript alone.

## Policy

- Give each boundary one runtime schema or route input schema. Derive its
  TypeScript type from that schema.
- A parser at an outside or saved-data boundary must accept `unknown` and return
  checked data.
- Decide whether each schema rejects or removes unknown fields. Use `.strict()`
  when an unknown field could change identity, authority, routing, or a saved
  result.
- Keep actor, owner, admin authority, destination, correlation, and retry IDs
  explicit at write boundaries.
- Check ownership before reading or changing private or actor-owned records.
  Public catalog reads do not need an owner check.
- Missing permission or ownership context is an error. Do not infer it from a
  display name, nearby record, earlier request, or made-up value.
- Check untrusted provider data when it enters Peated. Fail on invalid trusted
  state after Peated signs, saves, or queues it.
- Preserve identity and idempotency data across retries and resumed work.
- Model and tool input must not supply an owner, credential, permission, or
  other trusted value that code can derive from authenticated state.
- Require idempotency or uniqueness for APIs that create saved records from a
  retryable request.
- Check model output before saving it. Code owns permissions, identity, and
  irreversible changes.
- Save any value needed after a retry, resume, delivery, or process restart, or
  save a handle that can load it. In-memory values are caches only.

## Exceptions

- A named and bounded migration may repair old invalid data. Verify it apart
  from normal reads.
- An opaque provider value may stay permissive when it cannot affect routing,
  authorization, credentials, locks, or side effects.
