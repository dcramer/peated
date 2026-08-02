# Policies

Policies are durable repo-wide engineering rules and defaults. They are the
highest-authority repository documentation below executable configuration and
must remain consistent with code-enforced constraints.

Use a policy when the repository needs to say "this is how we do this here"
across multiple packages or features.

Do not use policies for:

- one feature's architecture or lifecycle;
- implementation plans, status, TODOs, or rollout tracking;
- copied schemas, commands, or test inventories;
- public product documentation.

Feature architecture and non-obvious invariants belong in the owning package,
module, or feature documentation. Code, runtime schemas, exported types, and
tests define the implemented contract. Temporary implementation plans live
under `../../openspec/changes/` and cannot override policy.

Current policies:

- [agent-design.md](agent-design.md)
- [background-work.md](background-work.md)
- [code-comments.md](code-comments.md)
- [correctness-complexity.md](correctness-complexity.md)
- [data-redaction.md](data-redaction.md)
- [error-handling.md](error-handling.md)
- [evals.md](evals.md)
- [frontend-components.md](frontend-components.md)
- [interface-design.md](interface-design.md)
- [observability.md](observability.md)
- [runtime-boundaries.md](runtime-boundaries.md)
- [web-route-layouts.md](web-route-layouts.md)

Backend and frontend testing expectations live in
[../development/backend-testing.md](../development/backend-testing.md) and
[../development/frontend-testing.md](../development/frontend-testing.md). Keep
those documents as the source of truth instead of duplicating them here.

Keep policies short: explain the intent, state the default, and name only
meaningful exceptions. Update the policy directly when the repo intends to
change the default; silence elsewhere does not create an exception.

Use [policy-template.md](policy-template.md) for new policies.
