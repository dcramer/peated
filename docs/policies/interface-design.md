# Interface Design

## Intent

Interfaces should expose the smallest useful capability while keeping
ownership, lifecycle, and security boundaries obvious. Module paths, file
names, type names, and function names are all part of the interface.

## Policy

- Prefer narrow capability functions over broad dependency bags or access to
  underlying clients and services.
- Expose lifecycle-oriented operations such as `dispatch`, `store`, `verify`,
  or `resolve` instead of raw runners, clients, routes, or storage adapters.
- Return projections by default. Do not expose full internal records when a
  caller only needs status, ids, or a summary.
- Make ownership explicit. A caller should only read or mutate records it owns
  unless cross-owner access is the feature and is checked at the boundary.
- Keep provider and framework details inside their owning layer. Shared code
  should depend on Peated-owned contracts rather than SDK types.
- Require idempotency keys for interfaces that create durable work from
  retryable contexts.
- Use the same domain noun for the same concept across types, fields, functions,
  storage keys, and documentation. Two names should mean two concepts, not two
  layers of the same concept.
- Prefer short names that use module and parent-object context. Avoid suffixes
  such as `Record`, `State`, `Data`, `Payload`, `Manager`, and `Handler` unless
  that shape or role is the actual boundary being named.
- Name modules after the concern they own, not the adapter or mechanism they
  happen to use.
- Keep exported interfaces role-shaped and small. Add an interface only when it
  removes real coupling or represents a stable boundary.
- Avoid one-hop wrappers and renamed aliases that only forward arguments. An
  intermediate function should enforce an invariant, translate a boundary, or
  own a lifecycle transition.

## Exceptions

- Low-level infrastructure modules may expose mechanism-specific APIs inside
  their own ownership boundary.
- Compatibility names may remain at external boundaries or legacy storage
  keys. New internal names should use the current domain term.
- Test fixtures may expose narrower construction seams when the production
  interface remains small.
