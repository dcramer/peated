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
- A fallback model, provider, tool, or agent is a separate product behavior, not
  default resilience. Add one only when its semantic contract and degraded
  capability are explicit and independently evaluated. Otherwise omit an
  unavailable optional capability or fail at its owning boundary.
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
- Prompts must keep stable policy separate from dynamic context.
- Prompt simplification means removing duplication and request-specific facts,
  not removing the stable domain rules needed to make the decision. Keep the
  mission, success criteria, decision policy, cross-tool policy, and output
  contract explicit; put tool mechanics in tool descriptions and live facts in
  runtime context.
- Improve retrieval, candidates, and source context before expanding prompts.
- When search results are only discovery candidates, use a separate focused-read
  capability for exact evidence. Search rank and snippets are not proof.
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
