# Policies

Policies are durable repo-wide engineering rules and defaults. They sit below
executable configuration and must match code-enforced constraints.

Use a policy when the repo must say "this is how we do this here" across
packages or features. Examples include testing, comments, security, privacy,
error handling, interface design, and background work.

Do not use policies for:

- one feature's design or state changes
- plans, status notes, TODOs, or rollout tracking
- copied schemas, commands, or test inventories
- public product docs

Put feature architecture and non-obvious rules in the owning package, module,
or feature documentation. Code, runtime schemas, exported types, and tests
define the real contract. Temporary plans live under `../../openspec/changes/`
and cannot override policy.

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

Keep policies short. Use common words, active voice, short sentences, and one
idea per sentence. Keep required domain terms, but explain them when the reader
may not know them. Remove other jargon. State the intent, the default, and only
real exceptions. Update the policy when the repo changes the default. Silence
elsewhere does not create an exception.

Use [policy-template.md](policy-template.md) for new policies.
