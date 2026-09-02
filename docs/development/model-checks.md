# Model Checks (Evals)

## Purpose

A model check runs model-facing behavior through the real runtime. It measures
judgment that a repeatable code test cannot prove.

## Rules

- Keep model checks separate from `pnpm test`. Run them with `pnpm evals`.
- Use realistic input. Do not steer a fixture toward its expected answer.
- Check structured outcomes and product rules, not incidental wording or an
  exact internal sequence.
- Do not copy fixture names, exact inputs, expected answers, or distinctive
  phrases into a product prompt.
- Find the layer that owns a failure before editing: input context, retrieval,
  tool execution, model judgment, code review, integration, or the expectation.
- Use normal tests for schemas, transport, persistence, permissions, and other
  behavior owned by code.
- Check exact structured fields directly. Use a model judge only for subjective
  output.
- A production-miss fixture must preserve the observed input, independently
  verify the subject, state the intended outcome, and record its source.
- Keep the production fixture after a fix. Add a second case with different
  concrete values to prove the general rule.
- Commit replay recordings required by a deliberate fixture or harness change.
  Do not record a provider failure as empty evidence.
- Run focused model checks while changing model behavior. Run the full suite
  once at a deliberate checkpoint.

Exact wording or tool order can be checked when it is the product contract.
