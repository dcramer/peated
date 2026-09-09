---
name: deslop
description: Simplifies existing Peated code, docs, prompts, plans, or explanations without changing required behavior. Use when asked to deslop, simplify, remove jargon, trim, or reduce overengineering. Do not use for unrelated feature work or broad cleanup.
---

# Deslop

Remove words and structure the current task does not need. Keep its behavior and
safeguards.

## Set Scope

Read the root `AGENTS.md`, the nearest scoped `AGENTS.md`, and the code, tests,
or docs that own the behavior. State what must remain true before changing it.

Treat the user's target as the boundary. Fix affected callers, tests, examples,
and docs, but do not turn a focused simplification into a repository-wide
cleanup.

## Remove Slop

Look for complexity that has no current use or requirement:

- jargon, vague or inflated prose, and unfamiliar words where common words are
  exact;
- wrappers that only rename or forward arguments;
- generic managers, services, registries, factories, and configuration layers
  that serve one known case;
- options, extension points, fallbacks, compatibility paths, and abstractions
  justified only by a possible future need;
- duplicate names, types, state, validation, comments, or documentation;
- helpers that hide a short operation or split one concern across many files;
- broad error handling, retries, or logging that obscures the real owner;
- plans, TODOs, and transitional code whose work is complete.

Prefer familiar domain names, short sentences, active voice, small functions and
modules, plain objects, and simple types. Prefer deleting a concept over renaming
it when nothing still needs it.

## Preserve Necessary Structure

Do not remove structure that enforces behavior. Keep:

- stored IDs, links, ownership, history, evidence, and source relationships;
- permission, privacy, validation, identity, idempotency, transaction, and
  concurrency boundaries;
- stable public or saved contracts unless the task includes a safe migration;
- domain terms that are more exact than a simpler-sounding substitute;
- tests for required behavior and comments that explain a non-obvious rule or
  owner;
- accessibility, logs, traces, failure reporting, and operational safeguards
  that have a current use.

Do not call code overengineered merely because it has layers. Show which layer,
option, or concept is unused, duplicated, or owned elsewhere. When evidence is
weak, leave the design alone or present the tradeoff instead of guessing.

## Follow Peated Policies

Peated's policies still apply. Read those relevant to the target:

- [Policy scope](../../docs/policies/README.md): Keep durable rules with a clear
  concern and an enforceable owner.
- [Agent design](../../docs/policies/agent-design.md): Use ordinary code for
  fixed rules. Keep model workflows small, bounded, checked, and measurable.
- [Background work](../../docs/policies/background-work.md): Persist durable
  state first. Make retries bounded, owned, and safe to repeat.
- [Code comments](../../docs/policies/code-comments.md): Explain non-obvious
  rules and tradeoffs. Remove narration and completed transition notes.
- [Data and permissions](../../docs/policies/data-and-permissions.md): Validate
  every boundary and keep identity, ownership, authority, and retry state
  explicit.
- [Database correctness](../../docs/policies/database-correctness.md): Preserve
  identity and relationships. Use constraints, locks, versions, and
  transactions for concurrent writes.
- [Error handling](../../docs/policies/error-handling.md): Let unexpected errors
  reach their owner. Catch only to recover, translate, or clean up.
- [Interfaces](../../docs/policies/interfaces.md): Expose the smallest useful
  action. Do not add wrappers or broad dependency objects without real
  behavior.
- [Logs and traces](../../docs/policies/logs-and-traces.md): Record stable events
  and safe context once at the boundary that owns the failure.
- [Naming](../../docs/policies/naming.md): Use one Peated domain name for one
  concept. Treat generic architecture words as warning signs.
- [Sensitive data](../../docs/policies/sensitive-data.md): Keep credentials,
  private content, direct identifiers, and unrestricted payloads out of logs,
  tools, models, and errors.

Use the relevant development testing guide too. Backend tests are
integration-first, frontend tests cover behavior rather than appearance, and
live model checks stay separate from deterministic tests.

For customer-facing Peated copy, also follow `skills/peated-writing/SKILL.md`.

## Finish

Search for every affected use. Remove code and prose made obsolete by the
change. Preserve compatibility only when a current caller, saved value, or
published contract requires it.

Run focused tests, typechecks, lint, and formatting. Use manual QA where those
checks cannot prove behavior. Report what became simpler, what behavior stayed
the same, and any check that could not run.

Finish when the target has fewer unnecessary words, concepts, or paths, every
remaining abstraction has a current reason, and required checks pass.
