# Bottle Classifier

This document describes the single classifier boundary for bottle reference matching.

Price matching is only one consumer of this module. The classifier is responsible
for bottle identity reasoning for any generic bottle reference input.

The implementation lives in:

- `packages/bottle-classifier/src/classifier.ts`
- `packages/bottle-classifier/src/classifierRuntime.ts`
- `packages/bottle-classifier/src/contract.ts`
- `packages/bottle-classifier/src/evalFixtureSchemas.ts`
- `packages/bottle-classifier/src/eval-fixtures/`
- `packages/bottle-classifier/README.md`
- `packages/bottle-classifier/AGENTS.md`

Server composition lives in:

- `apps/server/src/agents/bottleClassifier/service.ts`

Classifier-owned infrastructure lives in:

- `packages/bottle-classifier/src/instructions.ts`
- `packages/bottle-classifier/src/extractor.ts`
- `packages/bottle-classifier/src/reviewPolicy.ts`
- `packages/bottle-classifier/src/normalize.ts`
- `packages/bottle-classifier/src/legacyReleaseRepairIdentity.ts`
- `packages/bottle-classifier/src/bottleCreationDrafts.ts`
- `packages/bottle-classifier/src/priceMatchingEvidence.ts`

Injected server adapters live in:

- `apps/server/src/lib/bottleReferenceCandidates.ts`

## Goal

The classifier should be the only module that turns a raw bottle reference into a reviewed identity decision.

It owns:

1. best-effort structured extraction
2. initial local candidate retrieval
3. LLM-led reasoning
4. server-side validation of model output
5. deterministic downgrade rules
6. exact-cask versus parent-bottle scope

Everything downstream should treat the classifier output as authoritative for bottle identity reasoning. Use-case-specific policy such as price-match automation should consume that output rather than reshaping the classifier itself.

## Public Contract

The public entrypoint is:

- `classifyBottleReference({ reference, extractedIdentity?, initialCandidates?, candidateExpansion? })`

`reference` is intentionally generic. It is not tied to the `store_prices` row type; it is the minimum identity/context needed for matching:

- `name`
- `url?`
- `imageUrl?`
- `currentBottleId?`
- `currentReleaseId?`
- optional tracing metadata such as `id` and `externalSiteId`

Optional `extractedIdentity` and `initialCandidates` inputs exist for callers that already have extracted identity or candidate sets, but normal callers should pass only `reference`.
`candidateExpansion` defaults to `open`; set `candidateExpansion: "initial_only"` for closed-set review flows that must stay within the supplied candidate set.

The boundary is schema-backed in `contract.ts` so evals and downstream consumers can validate the exact request and response shape.

The package root should stay small and export only the core classify/normalize entrypoints used by most consumers:

- `createBottleClassifier(...)`
- `createWhiskyLabelExtractor(...)`
- `normalizeBottle(...)`
- `normalizeBottleCreationDrafts(...)`
- `getResolvedReleaseIdentity(...)`
- `formatCanonicalReleaseName(...)`

The package also owns the deterministic normalization entrypoints used by
classifier policy and server consumers:

- `normalizeBottle(...)`
- `normalizeBottleCreationDrafts(...)`
- `deriveLegacyReleaseRepairIdentity(...)`
- `resolveLegacyCreateParentClassification(...)`

Those helpers should stay package-owned and fixture-tested so server code can
remain focused on retrieval, persistence, and automation policy.

The rule for package-owned deterministic behavior is strict:

- deterministic helpers may only own structurally safe, effectively zero-ambiguity behavior
- if the behavior depends on brand context, marketed family meaning, or program semantics, it stays classifier-owned
- if the input is too sparse to safely infer a canonical bottle, block instead of guessing
- prompt changes should encode generalized reasoning patterns, not one-off brand tutoring; concrete family regressions belong in eval fixtures
- real-world new-bottle fixtures should record `peatedBottleIds` when the example came from an observed Peated bottle family
- ambiguous families should still add paired positive and negative fixtures, even though the executable source of truth is now one JSON file per case
- live eval coverage should stay narrow and explicit; only classifier-owned ambiguity should opt in

For lightweight consumers, prefer the narrow package subpaths:

- `@peated/bottle-classifier/normalize`
- `@peated/bottle-classifier/bottleCreationDrafts`
- `@peated/bottle-classifier/legacyReleaseRepairIdentity`
- `@peated/bottle-classifier/legacyReleaseRepairResolution`
- `@peated/bottle-classifier/priceMatchingEvidence`
- `@peated/bottle-classifier/smws`
- `@peated/bottle-classifier/contract`

Internal server adapters should use the explicit internal namespace:

- `@peated/bottle-classifier/internal/runtime`
- `@peated/bottle-classifier/internal/types`
- `@peated/bottle-classifier/internal/extractor`
- `@peated/bottle-classifier/internal/prompts`
- `@peated/bottle-classifier/internal/policy`

## Pipeline

The classifier runs in this order:

1. Extract structured whisky identity from the reference image or text.
2. Deterministically ignore obvious non-whisky references plus clearly non-single-bottle rows such as multipacks, gift sets, sampler bundles, and damaged-condition sale listings.
3. Retrieve initial local bottle/release candidates.
4. Run the LLM reasoner with local search, entity search, and web search tools.
5. Sanitize the returned decision against known candidates and resolved entities.
6. Normalize create actions into reviewed `create_bottle`, `create_release`, or `create_bottle_and_release` outcomes.
7. Infer `identityScope = product | exact_cask` deterministically.
8. Downgrade unsafe existing-match recommendations when the candidate is only a loose near-match and there is no exact-name or off-retailer support.

## Invariants

These rules should remain centralized in the classifier:

- The model may suggest only known candidate bottle/release ids.
- Create drafts must be normalized before persistence.
- Unsupported novelty flavored-whiskey / whiskey-liqueur exclusion is model-driven, not regex-driven.
- A flavor-adjacent noun in the expression is not enough to exclude a bottle. Official catalogued whisky expressions can still match when the overall evidence says the product is a real whisky bottle rather than a novelty additive-flavor product.
- Over-specific local candidates should not be matched unless the missing differentiator is actually supported.
- Web evidence is support, not identity by itself.
- Web search should stay narrow and hypothesis-driven. The classifier should usually make at most one web search call, and only spend a second call when the first results are weak or contradictory on a still-decisive trait.
- Confidence calibration matters because downstream consumers use classifier confidence to decide whether a reviewed existing match is safe to auto-verify or should stay in review.
- Brand decisions must distinguish consumer-facing brand from distillery, bottler, owner, importer, and product/category wording. A longer leading string match is not sufficient identity evidence.
- `fullName` and aliases are weak evidence for brand/entity repairs because they combine brand text with bottle expression text and may be stale.
- Generic `single cask` / `single barrel` language is not enough to infer `exact_cask`; exact-cask scope needs a stronger marketed-identity signal such as a known program code or numbered cask identity.
- Downstream consumers should adapt the reviewed classifier result instead of “fixing up” raw model decisions.
- Consumer-specific semantics such as price-match `correction` should be derived outside the generic classifier.
- `create_release` only makes sense when the target bottle is acting as a reusable parent expression, not when the bottle is still storing a single known release-like identity on itself.
- Downstream persistence must not create a child release while keeping the same release-like traits on the parent bottle. Split the bottle explicitly first.
- Metadata corrections must validate the resulting canonical identity before suggesting or applying them, including brand-derived bottle and release names.

## Result Shape

The classifier returns:

- `status = ignored | classified`
- `reason` when ignored
- `decision` when classified
- `artifacts`

The reviewed `decision` is generic and bottle-centric:

- `action = match | create_bottle | create_release | create_bottle_and_release | no_match`
- `identityScope = product | exact_cask`
- `matchedBottleId` and optional `matchedReleaseId` for safe existing matches
- `parentBottleId` only for `create_release`
- `proposedBottle` / `proposedRelease` only for create outcomes
- `no_match` stays generic at this boundary; downstream consumers own any review or clarification workflow
- `observation` for non-canonical exact details such as selector names, cask numbers, bottle numbers, outturn, and exclusive wording

`artifacts` contains:

- `extractedIdentity`
- `candidates`
- `searchEvidence`
- `resolvedEntities`

That result is already reviewed for bottle identity. Downstream consumers may apply their own persistence or automation policy on top of it.

Price matching is the main example: it derives `match_existing`, `correction`, and `create_new` proposal semantics from the reviewed classifier result instead of asking the classifier to reason in price-match terms directly. Those downstream correction drafts may repair bottle metadata such as brand, distillery, bottler, series, category, and other bottle fields while keeping the same base bottle identity.

## Eval Surface

The classifier contract is intentionally shaped for evals:

- the input is a small generic reference object plus optional seeded identity/candidates
- the output always includes the normalized artifacts the classifier reasoned over
- ignored vs classified outcomes are explicit via `status`

That gives eval harnesses a stable place to score both the final decision and the intermediate evidence without reaching into price-matching persistence code.
Classifier evals should also score confidence calibration for cases that are meant to remain review-only versus safe for downstream automatic verification.

The current package-local eval harness lives in:

- `packages/bottle-classifier/src/classifier.eval.test.ts`
- `packages/bottle-classifier/src/classifier.eval.scenarios.ts`
- `packages/bottle-classifier/src/classifier.eval.fixtures.ts`
- `packages/bottle-classifier/src/evalFixtureSchemas.ts`
- `packages/bottle-classifier/src/eval-fixtures/decision-cases/`
- `packages/bottle-classifier/src/eval-fixtures/new-bottles/`
- `packages/bottle-classifier/src/eval-fixtures/legacy-release-repair/`
- `packages/bottle-classifier/src/legacyReleaseRepairResolution.eval.test.ts`
- `packages/bottle-classifier/src/legacyReleaseRepairResolution.eval.fixtures.ts`

The main live classifier eval runner is organized around workflow scenarios
instead of separate normalization-versus-classifier files:

- `new bottles`
- `match existing`
- `corrections`
- `ignore or reject`

That grouped runner still uses the same classifier runtime and includes the
real-world new-bottle boundary cases inside the `new bottles` scenario. The
difference is organizational: one classifier-facing harness with shared cache,
reporting, and scenario-level fixture grouping.

Run it from the repo root with:

- `pnpm evals`

Direct package-local runs still work:

- `pnpm evals:classifier`

The root `pnpm evals` entrypoint is the intended way to run live classifier
evals. It forwards extra Vitest args to the package runner and uses the
`vitest-evals` reporter configured in
`packages/bottle-classifier/vitest.evals.config.mts`.

Local setup for live evals:

- put `OPENAI_API_KEY` in the repo-root `.env.local`
- `OPENAI_MODEL` is optional for evals and defaults to `gpt-5.4` for the classifier pass
- `OPENAI_EVAL_MODEL` is optional and defaults to `gpt-5-mini` for judging so routine evals stay cheaper; override it if you want a different cost/quality tradeoff
- `OPENAI_HOST`, `OPENAI_ORGANIZATION`, and `OPENAI_PROJECT` are optional for proxy or non-default account routing
- `BRAVE_API_KEY` is optional; without it the classifier still runs with OpenAI web search only
- `BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES` is optional and defaults to `3`
- classifier evals cache normalized web-search tool results under the committed `packages/bottle-classifier/eval-cassettes/web-search/` directory by default, with one JSON cassette per query under tool-specific subdirectories
- cassette lookup uses canonical per-tool cache keys and remains backward-compatible with older key shapes so incidental cache-key cleanup does not invalidate committed fixtures
- `BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_MODE` controls the cassette behavior: `replay_or_record` by default, plus `replay_only`, `refresh`, or `live`
- `BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DIR` overrides the cassette directory when needed
- `pnpm evals:web-cache:clear` deletes recorded cassette files while keeping the committed cache root
- `pnpm --filter @peated/bottle-classifier fixtures:validate` explicitly validates all JSON fixture files against the package schemas

Notes:

- both `pnpm evals:classifier` and `pnpm --filter @peated/bottle-classifier evals` load the repo-root `.env` and then `.env.local`
- the eval suite is intentionally a live LLM integration test; each case runs the classifier and then an LLM judge scores the result
- the fixture set is meant to mirror production-style inputs such as SMWS listings, retailer titles, and user-entered shorthand names
- the repair eval set specifically scores the repair-facing interpretation layer, not just raw classifier actions, so reusable-parent safety can be tracked separately from generic classification quality
- new bottle families should add paired positive and negative examples whenever the wording is ambiguous enough to regress

## Internal Structure

The classifier is intentionally split into a few narrow modules:

- `classifier.ts` defines the narrow public classifier factory and public types.
- `contract.ts` defines the public request/response contract and normalized result artifacts.
- `classifierRuntime.ts` owns the reviewed orchestration boundary and the raw model/tool loop.
- `classifierTypes.ts` owns internal classifier working types and schemas that should not leak through the package root.
- `reviewPolicy.ts` owns deterministic validation, create normalization, exact-cask scope inference, and downgrade rules.
- `normalize.ts` owns shared bottle/name/category/volume normalization.
- `priceMatchingEvidence.ts` owns pure evidence/conflict checks shared with price matching.
- `bottleSchemaGuidance.ts` owns prompt-facing bottle versus release guidance text.
- `legacyReleaseRepairIdentity.ts` owns the pure release-repair parent/release split and reusable-parent matching heuristics.
- `legacyReleaseRepairResolution.ts` owns the pure repair-facing mapping from reviewed classifier output to reusable-parent, allow-create, or blocked release-repair outcomes.
- `smws.ts` owns pure SMWS code, flavor-profile, and cask parsing.
- `extractor.ts` owns bottle-label extraction.
- `instructions.ts` owns classifier and extractor prompts.
- `bottleCreationDrafts.ts` owns bottle/release draft normalization for create decisions.
- `apps/server/src/agents/bottleClassifier/service.ts` injects server search adapters and config.

Price matching and other server consumers still have compatibility wrappers for
older module names, but the canonical implementation now lives in the package.
New code and eval tooling should depend on the package and only use the server
layer for composition.

## Use Cases

Current consumers include:

- store-price proposal resolution
- review ingestion and unresolved review backfill through `apps/server/src/lib/bottleReferenceResolution.ts`
- legacy release-repair parent review through `apps/server/src/lib/legacyReleaseRepairClassifier.ts`

New consumers should depend on the same classifier contract instead of
re-implementing bottle extraction, candidate search, or LLM policy in parallel.

## Naming

Naming is intentional:

- `classifyBottleReference` is the reviewed classifier boundary.
- `runBottleClassifierAgent` is only the raw LLM/tool pass.

The word `classifier` should refer to the full reviewed pipeline, not just the LLM call.
