# Correctness and Complexity

## Intent

Correct behavior is required, but correctness work should not default to the
most exhaustive design an agent can imagine. A change is better only when its
correctness gain is worth the added code, states, callbacks, and maintenance
burden.

## Policy

- Evaluate non-trivial changes on correctness, simplicity, understandability
  for an average repo developer, and maintainability.
- Prefer the smallest design that closes the proven failure mode. Do not add
  speculative states, abstractions, retries, fallbacks, configuration, or
  recovery paths for failures outside the current contract.
- When correctness requires complexity, name the invariant at the owning
  boundary and keep the implementation local to that boundary.
- Avoid spreading one invariant across callbacks in multiple layers. If several
  layers must participate, one layer owns the lifecycle transition and the
  others expose narrow capabilities.
- Do not hide complexity behind best-effort logging, ambient context, or
  one-hop wrappers. If a future maintainer must know about hidden state to
  change behavior safely, the design is not simple.
- Require a simplification pass when a change is more correct but materially
  harder to understand, unless the risk is urgent and documented.
- Tests should prove the invariant at the highest useful boundary instead of
  encoding every internal step.

## Exceptions

- Security, privacy, data-loss, and duplicate-side-effect fixes may temporarily
  increase complexity when a smaller safe design is not available.
- Temporary complexity must be explicit in the pull request or follow-up issue,
  including the invariant it protects and the simplification that remains.
