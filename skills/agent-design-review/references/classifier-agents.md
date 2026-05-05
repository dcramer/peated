# Classifier-Style Agents

Use this reference for agents that extract structure, rank candidates, classify actions, route work, moderate content, or gate automation.

## Review Sequence

1. Load the domain contract before reviewing prompt wording.
2. Separate deterministic stages from model-driven stages.
3. Check retrieval or candidate quality before blaming the model.
4. Check thresholds, post-model validation, and human-review boundaries.
5. Require slice-based evals before recommending larger architecture changes.

If the system has no written schema, taxonomy, or action set, flag that gap first.

## Common Failure Types

- false positive final action
- false negative or missed match
- wrong abstain or over-escalation
- bad candidate set or missing evidence
- schema drift or normalization mismatch
- overconfident outputs on weak evidence
- threshold regression after prompt changes
- cost or latency regressions from unnecessary tool use

## Design Rules

- Keep the action set explicit and mutually exclusive.
- Add an abstain, `no_match`, or manual-review path when evidence can be weak.
- Keep candidate sets structured and comparable on decisive fields.
- Bias the runtime against costly false positives.
- Make confidence meaningful only if it drives thresholds or downstream policy.
- Validate model outputs after generation, not only in the prompt.

## Bottleneck Clues

| Symptom                                                    | Likely bottleneck                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| The model chooses the wrong item from a good candidate set | Decision policy, prompt clarity, tool descriptions, or calibration      |
| The right item is not present when the model decides       | Retrieval, normalization, or candidate generation                       |
| Model output looks good but persisted state is wrong       | Output schema, validation, or integration bugs                          |
| Confidence is high on weak evidence                        | Thresholding, confidence semantics, or missing abstain rules            |
| Queue load spikes after an "accuracy" change               | Threshold regression, auto-action policy, or precision/recall imbalance |

## Repo Anchor: Peated Classifiers

When the task is about the current bottle classifier, bottle matcher, or label
extractor, read:

- `docs/architecture/bottle-classifier.md`
- `packages/bottle-classifier/AGENTS.md`
- `packages/bottle-classifier/src/contract.ts`
- `packages/bottle-classifier/src/classifier.ts`
- `packages/bottle-classifier/src/classifierRuntime.ts`
- `packages/bottle-classifier/src/instructions.ts`
- `packages/bottle-classifier/src/reviewPolicy.ts`
- `packages/bottle-classifier/src/eval-fixtures/`
- `apps/server/src/agents/bottleClassifier/service.ts`
- `apps/server/src/lib/priceMatchingProposals.ts`
- `apps/server/src/lib/priceMatching.test.ts`

Then check:

- extraction conservatism: prefer `null` or `[]` over guessing
- decisive identity fields: producer, distillery, expression, series, edition, age, cask flags, ABV, and years
- candidate generation before web search
- reviewed action boundaries: `match`, `repair_bottle`, `create_bottle`, `create_release`, `create_bottle_and_release`, `no_match`
- `identityScope` boundaries: `product` versus `exact_cask`
- deterministic downgrade, validation, and automation thresholds
- server-side sanitization of ids and proposed entities
- non-whisky rejection and human-review boundaries

When the task is about the entity classifier, read:

- `docs/architecture/entity-classifier.md`
- `packages/entity-classifier/src/contract.ts`
- `packages/entity-classifier/src/classifierRuntime.ts`
- `packages/entity-classifier/src/classifierTypes.ts`
- `packages/entity-classifier/src/instructions.ts`
- `apps/server/src/agents/entityClassifier/service.ts`

Then check:

- queue discovery stays separate from classifier decisioning
- local entity search precedes web search
- reassignment includes only verified bottle ids
- metadata repair has authoritative support
- brand/entity remediation distinguishes brand, distillery, owner, bottler, importer, and product/category wording

## Eval Minimum

Require:

- confusion-style breakdown by action or class
- hard-slice examples for decisive error modes
- trace or tool-call review
- cost, latency, and tool-usage metrics
- before vs after comparison for proposed changes
