# Evals

## Intent

Evals are integration tests for model-facing behavior through the real runtime.
They measure judgment that deterministic tests cannot prove reliably.

## Policy

- Keep live/model evals separate from the normal test gate. `pnpm test` proves
  deterministic behavior; `pnpm evals` exercises hosted model behavior.
- Keep eval inputs realistic. Do not script a request or fixture to steer the
  model toward the expected answer.
- Assert behavior invariants and structured outcomes, not incidental wording or
  an exact internal execution sequence.
- Do not patch product prompts with fixture names, exact eval inputs, expected
  answers, or distinctive scenario phrases. Product examples must be neutral
  and separate from eval cases.
- When an eval fails, state the general product invariant it exposed before
  changing the prompt, retrieval, tools, schema, runtime, or automation policy.
  Fix the smallest implicated layer.
- Use evals for model-facing choices. Use unit or integration tests for schemas,
  transport, persistence, permissions, deterministic post-processing, and
  other code-owned behavior.
- Assert deterministic structured fields directly. Use an LLM judge only for
  genuinely subjective output and never to replace an exact assertion the
  harness can make.
- Production-miss fixtures must preserve the exact observed input, independently
  verify the real subject, state the exact intended system outcome, and encode
  that provenance in the fixture.
- When behavior changes to address a production miss, keep the production
  fixture and add a separate regression case that differs in the relevant
  concrete values. The production fixture preserves the miss; the separate case
  proves the generalized rule.
- Treat replay recordings as reproducible eval evidence. Commit recordings
  required to replay a deliberate fixture or harness change.
- Live evals are expensive. Run focused evals when model-sensitive behavior is
  intentionally changing; do not make full live evals part of routine testing.

## Exceptions

- Exact wording, tokens, or tool order may be asserted when that exact output is
  the product contract.
- One-off manual experiments may use direct model calls when they do not become
  reusable automation or mutate production data.
- Manual moderator workflows may bypass eval requirements when they do not
  become reusable automation.
