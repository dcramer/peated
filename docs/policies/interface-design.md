# Interface Design

## Intent

Interfaces should expose the smallest useful capability while keeping ownership,
lifecycle, and security boundaries obvious. Module paths, file names, type names,
and function names are all part of that interface.

## Policy

- Prefer narrow capability functions over broad dependency bags or access to
  underlying services.
- Expose lifecycle-oriented operations such as `dispatch`, `store`, `verify`,
  or `resolve` instead of raw runners, clients, routes, or storage adapters.
- Return views by default. Do not expose full internal records when callers only
  need status, ids, or summaries.
- Make ownership explicit at the API boundary. A caller should only read or
  change records it owns unless cross-owner access is the feature and is checked
  there.
- Keep framework and external-service details inside their owning layer. Shared
  code should depend on Peated-owned contracts rather than SDK types.
- Require idempotency keys for APIs that create durable work from
  retryable contexts.
- Use short JavaScript-facing names for public types and methods. Avoid names
  that describe implementation mechanics instead of product intent.
- Use the same domain noun for the same concept across types, fields, functions,
  storage keys, and docs. Two names should mean two concepts, not two layers of
  the same concept.
- Prefer simple domain nouns over names that combine the concept with its
  storage shape.
- Avoid suffixes such as `Record`, `State`, `Data`, `Payload`, `Manager`, and
  `Handler` unless that storage shape, lifecycle, or adapter role is the actual
  boundary being named.
- Spend local context instead of repeating it. Use module, parent-object,
  folder, and file context to keep function and field names short.
- Name modules by the concern they own, not by the adapter or mechanism they
  happen to use.
- Name indexes, queues, and storage keys by their membership and ordering when
  they serve more than one consumer. Do not name shared state after one process
  that happens to use it.
- Prefer import-site readability over globally unique names. Include a
  canonical domain term when an exact repo search would otherwise mix unrelated
  concepts, but do not repeat the module path in every name.
- When a term is overloaded in the product or platform, define it once in the
  owning module documentation and avoid using it for nearby concepts.
- Keep exported interfaces role-shaped and small. Add an interface only when it
  removes real coupling or represents a stable boundary.
- Avoid one-hop wrappers, renamed aliases, and helper layers that only forward
  arguments, options, or dependencies. Call the owning capability directly
  unless the intermediate function enforces a rule, translates a boundary, or
  owns a lifecycle change.
- If a helper exists only to hide parameter threading, inline it or move the
  repeated call shape to the owner that defines the contract.

## Exceptions

- Test fixtures may expose narrower construction seams when the production
  interface remains small.
- Low-level infrastructure modules may expose mechanism-specific APIs inside
  their own ownership boundary.
- Generic names are acceptable inside a tightly scoped module when the import
  path supplies the missing context. Use longer names only when imported roles
  would otherwise collide at common call sites.
- Compatibility names may remain at external boundaries or legacy storage
  keys. New internal names should still use the current domain term.
