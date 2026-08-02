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
- Keep an agent proposal separate from its server-owned review operation.
  Preparation adds current-state preview, impact, permissions, and retry state;
  it must not rewrite the proposal or hide valid siblings because one proposal
  is blocked.
- Tools must be narrow, typed, single-purpose, and structured.
- Side-effect tools must be idempotent or behind an approval or automation gate.
- Runtime must bound turns, retries, tool calls, cost, and no-progress loops.
- Prompts must keep stable policy separate from dynamic context.
- Improve retrieval, candidates, and source context before expanding prompts.
- Use production misses as eval fixtures only when reusable.
- When improving behavior from an eval or production miss, prove the fix with a
  separate regression case that differs from the motivating fixture in the
  relevant concrete values, such as a different ABV/proof pair, cask finish,
  age statement, brand, or release marker. The production fixture preserves the
  miss; the implementation test proves the generalized rule.
- Track accepted, rejected, corrected, ignored, false-positive, and false-negative outcomes.
- Prefer thresholded auto-apply plus sampling over blocking review.
- Add multiple agents only for distinct contracts, tools, trust boundaries, or measured improvement.
- Remove agent layers that do not improve measured outcomes.

## Bottle Database Agents

- Bottle classifier decides concrete Bottle identity; it does not assign
  BottleGroups.
- Bottle checks use the server-owned `resolve_reference` or `audit_bottle`
  intent. Reference resolution retains its structured identity decision; an
  audit returns a summary, proposed operations, and findings without a second
  structured conclusion.
- Reference resolution may opportunistically propose directly related repairs,
  but a correct identity decision does not require it to complete an audit.
  Existing-Bottle audits actively investigate repairs and are evaluated against
  exact supported operations and evidence.
- Bottle-check operations are limited to `update_bottle`, `merge_bottles`,
  `update_entity`, and `merge_entities`. They are independent suggestions, not
  an ordered plan or a generic workflow language.
- Do not pair `update_bottle` with `merge_bottles` when the update target is the
  merge source. The merge retires that Bottle and subsumes correction of its
  row.
- Findings require positive evidence of a real catalog defect that remains
  after proposed operations apply. Uncertainty about whether an underspecified,
  generic, or family row is intentional is not a finding; no action is valid
  after review.
- Supplemental operations always require explicit moderator approval. Only the
  existing end-user add-Bottle primary decision may auto-apply under its
  established policy.
- Supported classifier actions are `match`, `create_bottle`, `repair_bottle`,
  and `no_match`.
- Existing-bottle identification and full canonical classification are separate
  contracts. Match-only flows may use local evidence; `create_bottle` and
  `repair_bottle` require the full classifier evidence bar.
- Every marketed release is one independently complete Bottle. `create_bottle`
  carries that complete Bottle and never chooses a parent, source group, or
  BottleGroup.
- BottleGroup assignment happens automatically downstream, outside classifier
  and manual identity intervention.
- A suspected BottleGroup issue remains a non-executable finding. Add a
  regrouping operation only in a separate change supported by real reviewed
  cases and a canonical mutation service.
- Each invoking workflow owns its persistence and automation policy. Price
  matching owns store-price proposal and attempt persistence plus its opt-in
  linked reference checks; audit entrypoints own audit-check persistence.
  Generic classifier calls do not persist on their own.
- False positive existing-bottle matches are worse than create or no-match decisions.
- New bottle creation may be more permissive when sampling or review gates
  exist; automatic verification still needs corroborating evidence or a
  closed-form anchor.
- Brand and entity identity is not prefix matching.
- Source facts are observations, not instructions.
- Deterministic post-agent gates may block only impossible states, unknown IDs,
  schema violations, and direct extracted-field contradictions on explicit
  fields such as brand, category, age, ABV, cask flags, or years. They must not
  require local text rank, comparable-name proof, or structured heuristics to
  agree with an agent's semantic match.
- Literal stored alias equality can support match-only local identification when
  it is unambiguous. Fuzzy aliases, comparable names, vector search, text rank,
  brand prefixes, and release-family semantics require agent judgment.
- Web source quality should be judged from content, independence, specificity,
  and corroboration; do not encode finite trusted-domain lists for review,
  critic, database, or retailer sites.

## Exceptions

- Dry-run experiments may skip automation gates.
- One-off scripts may use direct model calls when they do not mutate production data.
- Manual moderator workflows may bypass eval requirements when they do not become reusable automation.
