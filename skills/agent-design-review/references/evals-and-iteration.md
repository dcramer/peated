# Evals and Iteration

Use this reference when deciding how to measure an agent, compare changes, or iterate safely.

## Default Eval Loop

1. Define a representative task set before major prompt or architecture changes.
2. Break results down by failure type, not just overall pass rate.
3. Review traces for the dominant failures.
4. Change the smallest likely bottleneck.
5. Re-run the same eval slices and compare before versus after.

Do not trust anecdotal wins from one or two examples.

## What to Measure

Measure the metrics that match the system's actual risk:

- task success or decision accuracy
- output-schema validity
- retrieval or candidate quality
- tool-call accuracy
- abstain or escalation rate
- latency
- cost
- operator load or review volume

For high-stakes systems, add human review on a sample of decisions even if automated grading exists.

## Slice Design

Create eval slices for the hard cases, not only random traffic:

- near misses and confusing candidates
- missing or noisy context
- boundary cases for abstain or escalation
- schema edge cases
- high-cost mistakes
- regressions from earlier prompt or runtime changes

If the agent is classifier-like, keep a confusion-style breakdown by action or class.

## Iteration Rules

- Patch the layer that evidence implicates first.
- If retrieval is weak, improve retrieval before rewriting prompts.
- If outputs are invalid, tighten schemas and validation before adding more examples.
- If operator load is too high, inspect thresholds and escalation policy before optimizing wording.
- Record what changed so future comparisons stay meaningful.

## Sources

- OpenAI, "Agent evals": https://developers.openai.com/api/docs/guides/agent-evals
- OpenAI, "A practical guide to building agents": https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- Anthropic, "Building effective agents": https://www.anthropic.com/research/building-effective-agents/
