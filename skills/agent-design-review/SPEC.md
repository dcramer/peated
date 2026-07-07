# Agent Design Review Specification

## Intent

`agent-design-review` helps agents design, review, and debug LLM agents and
agent-like workflows without jumping straight to prompt rewrites. It forces a
success contract, execution-path map, bottleneck diagnosis, and eval plan before
large prompt or architecture changes.

## Scope

In scope:

- single-agent, workflow, and multi-agent architecture review
- prompt structure, cache-friendly prompt templates, and provider-specific prompt shapes
- tool and schema design for tool-using agents
- runtime loops, trust boundaries, side effects, approvals, and fallbacks
- eval plans and iteration strategy
- classifier, matcher, router, extractor, ranker, and moderation-agent review

Out of scope:

- creating or maintaining general Codex skills
- running production migrations or live agent experiments by default
- generic code review unrelated to agent behavior
- repository-specific classifier implementation work unless the user asks to change code

## Users And Trigger Context

- Primary users: coding agents and maintainers working on LLM-backed behavior.
- Common user requests: design an agent, review an agent, improve a system
  prompt, improve tool calling, add structured outputs, reduce false positives,
  tune thresholds, or build evals for an agent.
- Should not trigger for ordinary feature work, PR creation, CI repair, or
  non-agent refactors unless agent behavior is part of the task.

## Runtime Contract

- Required first actions: set mode, define the success contract, and map the
  real execution path before recommending changes.
- Required outputs: architecture verdict, primary bottleneck, findings or design
  proposal, and an eval plan.
- Non-negotiable constraints: prefer the smallest effective change, do not treat
  prompt edits as the default fix, and keep deterministic validation outside the
  model when code can enforce it.
- Expected bundled files loaded at runtime: only the directly relevant
  `references/*.md` files named by `SKILL.md`.

## Source And Evidence Model

Authoritative sources:

- official provider docs for current provider-specific prompt, tool, schema,
  cache, safety, and eval behavior
- repo architecture docs and package-local agent instructions for Peated
  classifier-specific guidance
- current source code for execution paths, tools, schemas, thresholds, and
  post-model validation

Useful improvement sources:

- positive and negative examples in `references/review-examples.md`
- failures from classifier evals, CI, review comments, or production-safe traces
- `SOURCES.md` changelog entries for prior design decisions

Data that must not be stored:

- secrets
- customer data
- private URLs, raw traces, or identifiers not needed for reproduction

## Reference Architecture

- `SKILL.md` contains activation, routing, core workflow, and output contract.
- `SPEC.md` contains maintenance scope, evidence policy, and validation expectations.
- `SOURCES.md` contains provenance, decision records, open gaps, and changelog.
- `references/` contains optional runtime guidance loaded by decision branch.
- `scripts/` and `assets/` are currently unused.

## Validation

- Lightweight validation: confirm every file routed by `SKILL.md` exists under
  `references/`, and every repo path named in `references/classifier-agents.md`
  and `SOURCES.md` still exists.
- Discovery validation: confirm `.agents/skills/agent-design-review/SKILL.md`
  resolves when this repo uses the symlinked skill registration.
- Deeper validation: test realistic prompts manually or through a future
  `codex exec --json` harness when trigger quality or output quality changes.
- Acceptance gates: no broken referenced files, current Peated classifier paths,
  and no stale provider-specific claims when provider docs materially change.

## Known Limitations

Open gaps are tracked in `SOURCES.md` under "Open gaps" so they live in one
place with their next actions.

## Maintenance Notes

- Update `SKILL.md` when trigger behavior, routing, output format, or required
  workflow steps change.
- Update `SOURCES.md` when adding/removing sources, recording decisions, or
  refreshing repo/provider anchors.
- Update `references/*.md` when branch-specific runtime guidance changes.
- Add a dedicated eval harness only when manual prompt checks stop being enough.
