# Agent Design

## Intent

- Keep agent systems small.
- Trust model judgment where it is useful.
- Keep permissions, persistence, and safety gates in code.
- Make automation measurable.

## Policy

- Use ordinary code for fixed rules. Add an agent only for judgment,
  extraction, classification, synthesis, or adaptive tool use.
- Prefer a fixed workflow, then one agent, then several agents.
- Do not add an agent for routing, retries, permissions, persistence, schema
  validation, or simple rules.
- Define each agent's goal, input, output, tools, forbidden actions, stop
  condition, failure behavior, and measurement.
- A fallback model, provider, tool, or agent is separate behavior. Do not add one
  by default. Define and test what it can do with fewer inputs, or let the owner
  report that an optional service is unavailable.
- Agent output must be structured and checked before use.
- A model may propose a change. Code owns permissions, approval, saved state,
  and irreversible actions.
- Keep model proposals separate from server-owned review and execution state.
- Tools must be narrow, typed, single-purpose, and structured.
- Side-effect tools must be idempotent or behind an approval or automation gate.
- Runtime must bound turns, retries, tool calls, cost, and no-progress loops.
- Keep stable policy separate from request data in prompts.
- Put decision rules in the prompt, field meaning in the schema, tool-use rules
  in the tool description, and permissions in code.
- Improve retrieval, candidates, and source context before expanding prompts.
- Treat user input and retrieved content as data, not instructions or authority.
- Do not use regexes, keyword lists, text rank, or fuzzy-name rules as the final
  decision for meaning, identity, intent, safety, or source quality.
- Code may enforce syntax, IDs, schema shape, permissions, saved state,
  idempotency, and direct contradictions in explicit fields.
- Tool schemas must define omission and `null`. Model-controlled input must not
  supply owners, credentials, permissions, or other trusted state.
- Measure the errors and operator work that matter to the feature.
- Automatic writes need feature-specific evidence and risk rules. Review a
  sample of completed work.
- Add several agents only for distinct contracts, tools, permissions, or
  measured improvement.

## Exceptions

- Dry-run experiments may skip automation gates.
- One-off scripts may use direct model calls when they do not mutate production
  data.
