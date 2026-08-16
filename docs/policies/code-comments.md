# Code Comments

## Intent

Comments are for non-obvious intent, module ownership, rules, and tradeoffs.

They are not there to narrate obvious code.

## Policy

- Major entry-point modules need a short design comment: ownership, boundary,
  and key rules.
- Exported functions need a brief JSDoc comment that explains intent when the
  name and type do not make important behavior clear.
- Public TypeScript interfaces and their comments are the canonical internal
  API documentation. Public HTTP contracts remain owned by route schemas and
  the generated OpenAPI specification.
- Private functions also need JSDoc when they define an internal interface:
  handlers or factories, wire or storage formats, signing, durable state
  changes, telemetry or error boundaries, or retry and resume policy.
- Comment non-obvious rules, tradeoffs, and policy-driven behavior.
- When an owning boundary intentionally omits behavior a maintainer would
  reasonably expect, document that absence when it affects correctness,
  security, privacy, delivery, observability, or recovery.
- Transitional compatibility branches and fallbacks require a concrete removal
  TODO. Name the legacy state or behavior and the release, issue, or condition
  that removes it. Do not only say "clean up later."
- Keep comments short, concrete, and current.

## Exceptions

- Do not comment obvious transformations or control flow.
- Do not add comments that simply restate the code in English.
- Small obvious leaf helpers do not need comments.
- If there is no concrete release or condition for removing a compatibility
  path, prefer a hard cutover instead of adding the path.
