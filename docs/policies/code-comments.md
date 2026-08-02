# Code Comments

## Intent

Comments are for non-obvious intent, ownership, invariants, and tradeoffs.

They are not there to narrate obvious code.

## Policy

- Major entry-point and boundary modules need a short design comment naming what
  they own, what stays outside the boundary, and the invariants a maintainer
  must preserve.
- When a repository policy is implemented by a specific module or exported
  interface, add or update a nearby module comment or JSDoc. State the
  policy-bearing behavior and link the owning policy when that helps discovery;
  do not copy the whole policy into code.
- Shared exported functions need brief intent-focused JSDoc when their name and
  type do not communicate important side effects, omissions, trust boundaries,
  or failure behavior.
- Private helpers also need JSDoc when they define an internal interface such as
  a wire or storage format, signing boundary, durable state transition,
  telemetry/error boundary, or retry/resume policy.
- Document intentionally omitted behavior when a maintainer would reasonably
  expect it and the omission affects correctness, security, privacy,
  observability, delivery, or recovery.
- Keep comments short and concrete. Explain why the code exists or what
  boundary it protects.
- Delete or rewrite stale comments immediately when behavior changes.

## Exceptions

- Do not comment obvious transformations or control flow.
- Do not add comments that simply restate the code in English.
- Small, obvious leaf helpers do not need comments merely because they are
  exported.
