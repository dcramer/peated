# Bottle Classifier

This document describes the single classifier boundary for bottle reference matching.

Price matching is only one consumer of this module. The classifier is responsible
for bottle identity reasoning for any generic bottle reference input.

The implementation lives in:

- `apps/server/src/agents/bottleClassifier/classifyBottleReference.ts`
- `apps/server/src/agents/bottleClassifier/contract.ts`

The low-level LLM/tool runner lives in:

- `apps/server/src/agents/bottleClassifier/runBottleClassifierAgent.ts`

Shared bottle-classifier infrastructure lives in:

- `apps/server/src/lib/bottleReferenceCandidates.ts`
- `apps/server/src/lib/bottleCreationDrafts.ts`

## Goal

The classifier should be the only module that turns a raw bottle reference into a reviewed matching decision.

It owns:

1. best-effort structured extraction
2. initial local candidate retrieval
3. LLM-led reasoning
4. server-side validation of model output
5. deterministic downgrade rules

Everything downstream should treat the classifier output as authoritative for bottle identity reasoning. Use-case-specific policy such as price-match automation should consume that output rather than reshaping the classifier itself.

## Public Contract

The public entrypoint is:

- `classifyBottleReference({ reference, extractedIdentity?, initialCandidates? })`

`reference` is intentionally generic. It is not tied to the `store_prices` row type; it is the minimum identity/context needed for matching:

- `name`
- `url?`
- `imageUrl?`
- `currentBottleId?`
- `currentReleaseId?`
- optional tracing metadata such as `id` and `externalSiteId`

Optional overrides exist for callers that already have extracted identity or candidate sets, but normal callers should pass only `reference`.

The boundary is schema-backed in `contract.ts` so evals and downstream consumers can validate the exact request and response shape.

## Pipeline

The classifier runs in this order:

1. Extract structured whisky identity from the reference image or text.
2. If extraction fails and the title is trivially non-whisky, return an ignored result.
3. Retrieve initial local bottle/release candidates.
4. Run the LLM reasoner with local search, entity search, and web search tools.
5. Sanitize the returned decision against known candidates and resolved entities.
6. Downgrade unsafe existing-match recommendations when the candidate is only a loose near-match and there is no exact-name or off-retailer support.

## Invariants

These rules should remain centralized in the classifier:

- The model may suggest only known candidate bottle/release ids.
- `create_new` drafts must be normalized before persistence.
- Flavored whisky / novelty drink exclusion is model-driven, not regex-driven.
- Over-specific local candidates should not be matched unless the missing differentiator is actually supported.
- Web evidence is support, not identity by itself.
- Proposal resolution should not “fix up” raw model decisions after the classifier returns.

## Result Shape

The classifier returns:

- `status = ignored | classified`
- `reason` when ignored
- `decision` when classified
- `artifacts`

`artifacts` contains:

- `extractedIdentity`
- `candidates`
- `searchEvidence`
- `resolvedEntities`

That result is already reviewed for bottle identity. Downstream consumers may apply their own persistence or automation policy on top of it.

## Eval Surface

The classifier contract is intentionally shaped for evals:

- the input is a small generic reference object plus optional seeded identity/candidates
- the output always includes the normalized artifacts the classifier reasoned over
- ignored vs classified outcomes are explicit via `status`

That gives eval harnesses a stable place to score both the final decision and the intermediate evidence without reaching into price-matching persistence code.

## Internal Structure

The classifier is intentionally split into a few narrow modules:

- `contract.ts` defines the public API and normalized result artifacts.
- `classifyBottleReference.ts` is the reviewed orchestration boundary.
- `runBottleClassifierAgent.ts` is only the model/tool loop.
- `classificationPolicy.ts` owns deterministic validation and downgrade rules.
- `bottleReferenceCandidates.ts` owns extraction and local candidate retrieval.
- `bottleCreationDrafts.ts` owns bottle/release draft normalization for `create_new`.

Price matching still has compatibility wrappers for some older module names, but
the canonical implementation now lives under the generic bottle-classifier
names above. New code and eval tooling should depend on the generic modules.

## Use Cases

Current consumers include:

- store-price proposal resolution

Future consumers should depend on the same classifier contract instead of
re-implementing bottle extraction, candidate search, or LLM policy in parallel.

## Naming

Naming is intentional:

- `classifyBottleReference` is the reviewed classifier boundary.
- `runBottleClassifierAgent` is only the raw LLM/tool pass.

The word `classifier` should refer to the full reviewed pipeline, not just the LLM call.
