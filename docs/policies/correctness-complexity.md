# Correctness and Complexity

## Intent

Correct behavior is required. Correctness work should not default to the most
exhaustive design an agent can invent. A change is better only when its
correctness gain is worth the added code, states, callbacks, and maintenance
cost.

## Policy

- Judge non-trivial changes on four axes: correctness, simplicity,
  understandability for an average repo developer, and maintainability.
- Prefer the smallest design that closes the proven failure mode. Do not add
  speculative states, abstractions, retries, fallbacks, configuration, or
  recovery paths for failures that are not part of the current contract.
- When correctness needs complexity, name the rule at the owning boundary and
  keep the implementation local to that boundary.
- Avoid spreading one rule across callbacks in many layers. If several layers
  must take part, one layer should own the lifecycle change. The others should
  expose narrow capabilities.
- Do not hide complexity behind best-effort logging, ambient context, or
  one-hop wrappers. If a future developer must know about the hidden state to
  change behavior safely, the design is not simple.
- A review that finds "more correct but harder to understand" should require a
  simplification pass before merge unless the risk is urgent and documented.
- Tests should prove the rule at the highest useful boundary. They should not
  encode every internal step of a complex implementation.

## Exceptions

- Security, privacy, data-loss, and duplicate-side-effect fixes may temporarily
  increase complexity when a smaller safe design is not available in the same
  change.
- Temporary complexity must be explicit in the pull request or follow-up issue.
  Name the rule it protects and the simplification that remains.
