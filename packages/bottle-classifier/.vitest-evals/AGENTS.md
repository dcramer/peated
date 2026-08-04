# Agent Instructions

- Replay recordings are eval artifacts and should be committed when they are
  deliberately created or updated for a fixture, harness, model-tool contract,
  or provider change.
- Do not delete or rewrite recordings just because they look like local cache.
  Remove them only when the corresponding eval case, tool, or replay provider
  is intentionally removed.
- When recording new tool calls, prefer the narrowest scoped eval command and
  keep unrelated replay churn out of the changeset.
- Commit only contract-valid successful tool responses. A provider error,
  including an error nested inside a batched response, must fail replay
  validation rather than become empty evidence.
- When a tool or provider is intentionally replaced, remove its obsolete
  recordings and review the replacement recordings as part of that contract
  change. Do not preserve stale provider behavior as an implicit fallback.
