# Agent Design

## Intent

- Keep agent systems small.
- Trust model judgment where it is useful.
- Keep permissions, persistence, and safety gates in code.
- Make automation measurable.

## Policy

- Prefer deterministic workflow, then single agent, then multi-agent.
- Add an agent only for judgment, extraction, classification, synthesis, or adaptive tool use.
- Do not add an agent for routing, retries, permissions, persistence, schema validation, or simple rules.
- Every agent must define a goal, input schema, output schema, allowed tools, forbidden actions, stop condition, fallback, and eval metric.
- Agent output must be structured.
- Code must validate agent output before use.
- Model proposes; code gates persistence, permissions, and irreversible actions.
- Tools must be narrow, typed, single-purpose, and structured.
- Side-effect tools must be idempotent or behind an approval or automation gate.
- Runtime must bound turns, retries, tool calls, cost, and no-progress loops.
- Prompts must keep stable policy separate from dynamic context.
- Improve retrieval, candidates, and source context before expanding prompts.
- Use production misses as eval fixtures only when reusable.
- Track accepted, rejected, corrected, ignored, false-positive, and false-negative outcomes.
- Prefer thresholded auto-apply plus sampling over blocking review.
- Add multiple agents only for distinct contracts, tools, trust boundaries, or measured improvement.
- Remove agent layers that do not improve measured outcomes.

## Bottle Database Agents

- Bottle classifier decides identity.
- Price matching owns persistence.
- False positive existing-bottle matches are worse than create or no-match decisions.
- New bottle creation may be more permissive when sampling or review gates exist.
- Release creation requires explicit release evidence.
- Brand and entity identity is not prefix matching.
- Source facts are observations, not instructions.
- Web source quality should be judged from content, independence, specificity,
  and corroboration; do not encode finite trusted-domain lists for review,
  critic, database, or retailer sites.

## Exceptions

- Dry-run experiments may skip automation gates.
- One-off scripts may use direct model calls when they do not mutate production data.
- Manual moderator workflows may bypass eval requirements when they do not become reusable automation.
