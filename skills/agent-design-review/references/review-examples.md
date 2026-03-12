# Review Examples

Use these examples to keep outputs concrete and bottleneck-focused.

## Happy Path: Existing Agent Review

Task: Review our matcher agent and reduce false positives.

Strong review shape:

1. Success contract names quality target and queue-load constraint.
2. Execution path separates normalization, retrieval, agent decision, and post-model validation.
3. Primary bottleneck is candidate recall, not prompt phrasing.
4. Smallest effective change improves retrieval and adds a recall-at-k eval on near-match cases.
5. Eval plan compares false positives, recall-at-k, latency, and review-queue volume before versus after.

## Happy Path: Prompt Rewrite Request

Task: Improve our system prompt and make it cache-friendly.

Strong review shape:

1. Maps which parts of the prompt are static versus dynamic.
2. Keeps tools, schema, and examples in a stable prefix.
3. Moves request-specific context later in the template.
4. Returns a prompt skeleton with explicit slots instead of a giant interpolated prompt.

## Robust Variant

Task: Improve our classifier agent without increasing operator load.

Strong review shape:

1. Findings distinguish model mistakes from threshold mistakes.
2. Recommendations include post-model validation, threshold tuning, and slice-based evals, not only prompt edits.
3. Eval plan measures quality, latency, cost, and escalation or queue rate together.

## Anti-Pattern

Weak finding:

- Improve the prompt and add a few-shot example.

Why it is weak:

- It names no success contract.
- It gives no execution path.
- It assumes prompt wording is the bottleneck.
- It ignores retrieval, thresholds, tools, and post-model validation.

Corrected finding:

- Primary bottleneck: the agent is making decisions from thin candidate sets, so prompt edits alone will not fix the errors.
- Evidence: traces show missing near-match candidates and tests do not measure recall on hard slices.
- Smallest effective change: improve candidate generation and add a recall-at-k eval before prompt rewrites.
