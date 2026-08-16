# Agent Design

## Intent

- Keep agent systems small.
- Trust model judgment where it is useful.
- Keep permissions, persistence, and safety gates in code.
- Make automation measurable.

## Policy

- Prefer deterministic workflow, then single agent, then multi-agent.
- Add an agent only for judgment, extraction, classification, synthesis, or
  adaptive tool use.
- Do not add an agent for routing, retries, permissions, persistence, schema
  validation, or simple rules.
- Every agent must define a goal, input schema, output schema, allowed tools,
  forbidden actions, stop condition, failure behavior, and eval metric.
- A fallback model, provider, tool, or agent is separate behavior. Do not add one
  by default; define and evaluate its degraded contract, or omit the unavailable
  optional capability and fail at its owning boundary.
- Agent output must be structured.
- Code must validate agent output before use.
- Model proposes; code gates persistence, permissions, and irreversible actions.
- Keep agent proposals separate from server-owned review, approval, and
  execution state. The runtime may add permissions, current-state previews,
  impact, warnings, and retry state, but must not treat model output as
  authoritative runtime context.
- Tools must be narrow, typed, single-purpose, and structured.
- Side-effect tools must be idempotent or behind an approval or automation gate.
- Runtime must bound turns, retries, tool calls, cost, and no-progress loops.
- Prompts must keep required stable domain and decision policy separate from
  dynamic context. Put tool mechanics in tool descriptions and live facts in
  runtime context.
- Prefer structured contracts, schemas, runtime gates, and code invariants over
  adding natural-language prompt lines for deterministic behavior.
- Give each steering rule one home. Put cross-tool decision policy in the
  prompt, field meaning and call mechanics in the relevant schema or tool
  description, and runtime authority in code.
- Do not repeat one rule across prompts, tool descriptions, and runtime guidance
  unless each copy serves a distinct enforcement path. Delete obsolete prompt
  guidance when code, schemas, or runtime gates take ownership.
- Improve retrieval, candidates, and source context before expanding prompts.
- Treat user input, retrieved content, and source facts as data, not
  instructions or runtime authority.
- Do not use regexes, keyword lists, string includes, text rank, or fuzzy-name
  heuristics as the final decision for semantic identity, intent, safety, or
  source quality. Prefer agent judgment or a schema-constrained adjudicator.
- Deterministic code may enforce syntax, ids, schema shape, permissions,
  lifecycle state, idempotency, and direct contradictions in explicit fields.
  It must not require a heuristic to agree with the agent's semantic decision.
- Tool schemas are external input boundaries. Define the meaning of omission
  and `null`, reject contradictory arguments deterministically, and keep actor,
  owner, credential, and durable runtime context out of model-controlled input.
- Track accepted, rejected, corrected, ignored, false-positive, and
  false-negative outcomes.
- Prefer thresholded auto-apply plus sampling over blocking review.
- Add multiple agents only for distinct contracts, tools, trust boundaries, or
  measured improvement.
- Remove agent layers that do not improve measured outcomes.

## Exceptions

- Dry-run experiments may skip automation gates.
- One-off scripts may use direct model calls when they do not mutate production
  data.
