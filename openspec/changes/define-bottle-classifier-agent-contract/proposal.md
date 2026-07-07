## Why

The bottle classifier agent has become a shared decision point for Add Bottle, store-price matching, review ingestion, creation, repair, and automation, but its normative contract is scattered across architecture docs, prompt prose, schemas, and eval fixtures. This makes prompt changes risky: it is too easy to optimize for a fixture, miss a bottle/release component, or change automation semantics without a stable spec.

## What Changes

- Define a first-class OpenSpec capability for the bottle classifier agent contract.
- Specify the agent's goal as validating an observed bottle or release reference against Peated catalog state and external evidence, then choosing the safest existing, create, repair, or no-match outcome.
- Specify where the agent sits in the flow: label text or image input, a deterministic exact-alias fast path that can skip the agent, agent judgment for everything else, and code-owned normalization and gating after the agent.
- Specify the required input concepts the prompt must explain, covering the full agent input envelope: extracted identity, image/source evidence, local candidates, candidate family context, web evidence, current assignment, candidate display fields, exact-alias state, candidate-expansion mode, and investigation hints.
- Specify how the agent distinguishes bottle identity, release identity, exact-cask identity, observation-only facts, alias safety, and source-scoped evidence.
- Remove numeric `confidence` and the confidence band from the agent output contract. The agent asserts structured evidence; consumer code derives any automation tier from action risk and that evidence. The agent's review veto is expressed as a typed unresolved risk, which can only force review, never upgrade automation.
- Specify prompt-instruction structure requirements so future prompt edits are organized, low-prose, and eval-driven without overfitting to current cases, including consolidating accreted precedence-override rules into an ordered decision workflow.
- Require the classifier prompt to stay static per instruction mode and consistent with the tool surface actually attached in that mode.
- Specify eval and provenance expectations for changing agent instructions or output semantics.

## Capabilities

### New Capabilities

- `bottle-classifier-agent`: Contract for the full bottle classifier agent, including goal, inputs, evidence use, output semantics, prompt-instruction structure, and eval validation.

### Modified Capabilities

- None.

## Impact

- Affected docs and planning artifacts: `openspec/changes/**`, `docs/architecture/bottle-classifier.md`, `docs/architecture/whisky-identity-model.md`, and `docs/architecture/bottle-creation-alias-system.md`. The bottle-classifier architecture doc's eval guidance changes from "confidence calibration" to deterministic tier-derivation correctness.
- Affected implementation areas for later apply work: `packages/bottle-classifier/src/instructions.ts`, `packages/bottle-classifier/src/classifierTypes.ts`, `packages/bottle-classifier/src/reviewPolicy.ts` confidence-reconciliation caps, `packages/bottle-classifier/src/priceMatchingEvidence.ts` numeric thresholds, `apps/server/src/lib/priceMatchingProposals.ts` confidence consumers, classifier eval fixtures, fixture validation, and replay recordings.
- No runtime behavior changes are introduced by this proposal alone.
