# Policies

Policies are short repo-wide defaults.

Use a policy doc when we want to say "this is how we normally do this here"
without turning it into a full architecture document or feature spec.

Good policy topics:

- code comments and docstrings
- frontend component ownership
- background work and retry boundaries
- runtime boundary schemas and ownership context
- agent design and automation boundaries
- testing expectations
- naming conventions
- migration hygiene
- automation safety boundaries

Current policies:

- [agent-design.md](agent-design.md)
- [background-work.md](background-work.md)
- [code-comments.md](code-comments.md)
- [frontend-components.md](frontend-components.md)
- [runtime-boundaries.md](runtime-boundaries.md)
- [web-route-layouts.md](web-route-layouts.md)

Backend testing expectations live in
[../development/backend-testing.md](../development/backend-testing.md). Keep
that integration-first test style as the source of truth instead of duplicating
it here.

Keep policy docs small:

- explain the intent briefly
- state the default rule clearly
- call out only the meaningful exceptions

Use [policy-template.md](/home/dcramer/src/peated/docs/policies/policy-template.md)
for new policies.
