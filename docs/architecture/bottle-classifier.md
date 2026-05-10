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
3. local entity resolution for extracted brand, bottler, and distillery names
4. targeted web investigation when local candidates are not exact enough
5. LLM-led reasoning
6. server-side validation of model output
7. deterministic downgrade rules
8. exact-cask versus parent-bottle scope

Everything downstream should treat the classifier output as authoritative for bottle identity reasoning. Use-case-specific policy such as price-match automation should consume that output rather than reshaping the classifier itself.

The classifier is nondeterministic in the important sense: semantic identity
placement is model-led and evidence-led, not a set of hard-coded whisky-family
rules. Deterministic code may extract structured facts, retrieve candidates,
validate ids, normalize drafts, block impossible states, and cap unsafe
automation confidence. It must not decide that a marketed family is a bottle or
release just because a brand name, year, or batch-like token matched a regex.

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
- post-model policy may sanitize, normalize, reject, or downgrade model output,
  but it must not promote semantic actions based on whisky-family heuristics
- if the behavior depends on brand context, marketed family meaning, or program semantics, it stays classifier-owned
- if the input is too sparse to safely infer a canonical bottle, block instead of guessing
- local retrieval may expose sibling context, dirty parent traits, and existing
  child releases, but that context is evidence for the model rather than a
  deterministic decision rule
- classifier system prompts must stay static; request-specific evidence belongs
  in runtime input, tools, tool schemas, and post-model validation
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
4. Resolve closed-form deterministic identities, currently SMWS code references,
   before entity search, web search, or agent reasoning.
5. Seed local entity search results for extracted brand, bottler, and distiller
   names.
6. Preload targeted web evidence for whisky-like references that have no exact
   local candidate and no current assignment.
7. Run the LLM reasoner with local search, entity search, and web search tools.
8. Sanitize the returned decision against known candidates and resolved entities.
9. Normalize create and repair actions into reviewed `create_bottle`,
   `create_release`, `create_bottle_and_release`, or `repair_bottle` outcomes.
10. Infer `identityScope = product | exact_cask` deterministically.
11. Downgrade unsafe existing-match recommendations when the candidate is only
    a loose near-match and there is no exact-name or validated supporting
    evidence.

## Invariants

These rules should remain centralized in the classifier:

- The model may suggest only known candidate bottle/release ids.
- Create and repair drafts must be normalized before persistence.
- Unsupported novelty flavored-whiskey / whiskey-liqueur exclusion is model-driven, not regex-driven.
- A flavor-adjacent noun in the expression is not enough to exclude a bottle. Official catalogued whisky expressions can still match when the overall evidence says the product is a real whisky bottle rather than a novelty additive-flavor product.
- Over-specific local candidates should not be matched unless the missing differentiator is actually supported.
- Web evidence is support, not identity by itself.
- Web search should stay narrow and hypothesis-driven. The classifier should usually make at most one web search call, and only spend a second call when the first results are weak or contradictory on a still-decisive trait.
- Confidence calibration matters because downstream consumers use classifier confidence to decide whether a reviewed existing match is safe to auto-verify or should stay in review.
- Brand decisions must distinguish consumer-facing brand from distillery, bottler, owner, importer, and product/category wording. A longer leading string match is not sufficient identity evidence.
- `fullName` and aliases are weak evidence for brand/entity repairs because they combine brand text with bottle expression text and may be stale.
- Generic `single cask` / `single barrel` language is not enough to infer `exact_cask`; exact-cask scope needs a stronger marketed-identity signal such as a known program code or numbered cask identity. For SMWS, the bottle code is the primary exact-cask anchor even when subtitles differ.
- Downstream consumers should adapt the reviewed classifier result instead of “fixing up” raw model decisions.
- Consumer-specific semantics such as price-match `correction` should be derived outside the generic classifier.
- `create_release` only makes sense when the target bottle is acting as a reusable parent expression, not when the bottle is still storing a single known release-like identity on itself.
- Downstream persistence must not create a child release while keeping the same release-like traits on the parent bottle. Split the bottle explicitly first.
- Metadata corrections must validate the resulting canonical identity before suggesting or applying them, including brand-derived bottle and release names.

## Evidence Trust Boundary

Source pages, search results, snippets, and retailer titles are evidence, not
policy. The classifier does not maintain a critic/reviewer domain allowlist for
creation or reviewed identity decisions. The agent must judge web evidence from
content, independence, specificity, and corroboration, then record that judgment
in `confidenceBasis`.

Post-model code may enforce narrow trust boundaries:

- the originating retailer is not decisive evidence for creation
- if the agent marks web evidence as `weak` or `conflicting`, creation is
  downgraded even when text tokens match
- official producer-like source tiers may support conservative automation checks
  for omitted traits, but critic, review, community, and database pages are not
  promoted by hardcoded domain lists

Web search tools should look for sources that help the agent decide; they should
not encode a finite list of trusted whisky sites.

## Tool Surface

The reasoning agent gets four read-only tools:

- `search_bottles`: local Peated bottle and release candidates
- `search_entities`: local Peated brand, distillery, and bottler entities
- `openai_web_search`: primary live web evidence search
- `brave_web_search`: optional second web index for sparse or weak results

Do not add source-specific web tools unless they return materially better
structured evidence than general web search and still preserve the same evidence
trust boundary.

## Result Shape

The classifier returns:

- `status = ignored | classified`
- `reason` when ignored
- `decision` when classified
- `artifacts`

The reviewed `decision` is generic and bottle-centric:

- `action = match | repair_bottle | create_bottle | create_release | create_bottle_and_release | no_match`
- `identityScope = product | exact_cask`
- `matchedBottleId` and optional `matchedReleaseId` for safe existing matches
- `matchedBottleId` plus `proposedBottle` for same-bottle metadata repair
- `parentBottleId` only for `create_release`
- `proposedBottle` / `proposedRelease` for create outcomes; `repair_bottle` carries only a `proposedBottle` patch draft
- `no_match` stays generic at this boundary; downstream consumers own any review or clarification workflow
- `observation` for non-canonical exact details such as selector names, cask numbers, bottle numbers, outturn, and exclusive wording
- optional `identityBasis` documenting which traits the agent treated as bottle
  identity, release identity, observation-only facts, year semantics, sibling
  evidence, and remaining uncertainty
- optional `confidenceBasis` documenting the evidence band, positive evidence,
  unresolved risks, tools actually used, and whether web evidence was not used,
  not needed, supportive, weak, or conflicting

`artifacts` contains:

- `extractedIdentity`
- `candidates`
- `searchEvidence`
- `resolvedEntities`

Candidate rows may include `familyContext`, a compact local summary of child
releases under the same parent and release-like traits still stored on the
parent row. This is supplied to help the model reason about single-known-release
and sibling-release cases without moving that judgment into deterministic code.

That result is already reviewed for bottle identity. Downstream consumers may apply their own persistence or automation policy on top of it.

Price matching is the main example: it derives `match_existing`, `correction`, and `create_new` proposal semantics from the reviewed classifier result instead of asking the classifier to reason in price-match terms directly. Those downstream correction drafts may repair bottle metadata such as brand, distillery, bottler, series, category, and other bottle fields while keeping the same base bottle identity.

## Eval Surface

The classifier contract is intentionally shaped for evals:

- the input is a small generic reference object plus optional seeded identity/candidates
- the output always includes the normalized artifacts the classifier reasoned over
- ignored vs classified outcomes are explicit via `status`

That gives eval harnesses a stable place to score both the final decision and the intermediate evidence without reaching into price-matching persistence code.
Classifier evals should also score confidence calibration for cases that are meant to remain review-only versus safe for downstream automatic verification.

The current package-local eval surface lives in:

- `packages/bottle-classifier/src/classifier.eval.test.ts`
- `packages/bottle-classifier/src/classifier.eval.scenarios.ts`
- `packages/bottle-classifier/src/classifier.eval.fixtures.ts`
- `packages/bottle-classifier/src/evalFixtureSchemas.ts`
- `packages/bottle-classifier/src/eval-fixtures/decision-cases/`
- `packages/bottle-classifier/src/eval-fixtures/new-bottles/`
- `packages/bottle-classifier/src/eval-fixtures/legacy-release-repair/`
- `packages/bottle-classifier/src/legacyReleaseRepairResolution.eval.test.ts`
- `packages/bottle-classifier/src/legacyReleaseRepairResolution.eval.fixtures.ts`

The live evals use `vitest-evals` harness-style `run(...)` tests with the
`@vitest-evals/harness-openai-agents` adapter for normalized output, reporter
metadata, named judges, and native harness `toolReplay` for classifier
web-search tools. The main classifier expectation judge is deterministic:
encoded expected fields are scored with normal field matching and local
normalization, not LLM-as-a-judge.

The main live classifier eval runner is organized around workflow scenarios
instead of separate normalization-versus-classifier files:

- `new bottles`
- `match existing`
- `corrections`

That grouped runner still uses the same classifier runtime and includes the
real-world new-bottle boundary cases inside the `new bottles` scenario. The
difference is organizational: one classifier-facing harness with shared replay,
reporting, and scenario-level fixture grouping.

Run it from the repo root with:

- `pnpm evals`

Direct package-local runs still work:

- `pnpm evals:classifier`

The root `pnpm evals` entrypoint is the intended way to run live classifier
evals. It forwards extra Vitest args to the package runner and uses the
`vitest-evals` reporter configured in
`packages/bottle-classifier/vitest.evals.config.mts`.

Production-miss eval checklist:

1. Preserve the exact observed case: source title, URL, extracted identity,
   current assignment, local candidates, and the failing classifier or
   automation outcome.
2. Verify the real bottle online before deciding the expected result. Prioritize
   producer or brand pages, official shops, independent whisky databases,
   competition records, reviews, and publications whose content specifically
   confirms the bottle traits. Do not use retailer SEO text alone as proof of
   canonical identity.
3. Decide the Peated DB action before encoding the eval: exact `bottleId`,
   exact `releaseId` or `null`, whether to create a `bottle_release`, whether a
   parent split is required, and which exact source facts stay in
   `bottle_observation`.
4. Encode the expected outcome for the exact real bottle. For existing matches,
   expected ids should be the actual Peated ids. For create paths, expected
   drafts should describe the canonical bottle or release that should exist.
5. Treat encoded expected fields as required. The shape judge should hard-fail
   wrong or missing required action, identity, id, bottle, and release fields;
   only unencoded optional enrichment may be missing without failing the case.
6. Add fixture `provenance.source = "production_miss"` with
   `verifiedSourceUrls` and `dbOutcome` so the web verification and intended DB
   result remain attached to the regression.
7. If a family can fail in both directions, add paired positive and negative
   fixtures. Do not move brand- or family-specific semantics into deterministic
   code just to satisfy the eval.

Local setup for live evals:

- put `OPENAI_API_KEY` in the repo-root `.env` or `.env.local`
- `vitest.evals.config.mts` loads `.env` and then `.env.local`; shell-provided env vars take precedence over both files
- `OPENAI_MODEL` is optional for evals and defaults to `gpt-5.4` for the classifier pass
- `OPENAI_EVAL_MODEL` is optional and defaults to `gpt-5-mini` for evals that still use an LLM judge, such as repair interpretation checks
- `OPENAI_HOST`, `OPENAI_ORGANIZATION`, and `OPENAI_PROJECT` are optional for proxy or non-default account routing
- `BRAVE_API_KEY` is optional; without it the classifier still runs with OpenAI web search only
- `BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES` is optional and defaults to `3`
- classifier evals use `@vitest-evals/harness-openai-agents` native `toolReplay` for `openai_web_search` and `brave_web_search`
- `VITEST_EVALS_REPLAY_DIR` defaults to the package-local upstream-style `packages/bottle-classifier/.vitest-evals/recordings/` directory through the eval Vitest config
- `VITEST_EVALS_REPLAY_MODE` defaults to `auto`; use the upstream `strict`, `record`, or `off` modes when needed
- replay JSON is eval evidence, not a local cache; commit only intentional replay changes
- `pnpm --filter @peated/bottle-classifier fixtures:validate` explicitly validates all JSON fixture files against the package schemas

Notes:

- both `pnpm evals:classifier` and `pnpm --filter @peated/bottle-classifier evals` load the repo-root `.env` and then `.env.local`
- the main classifier eval suite is intentionally a live classifier integration test, but required action/id/scope/draft expectations are scored deterministically rather than by an LLM judge
- the fixture set is meant to mirror production-style inputs such as SMWS listings, retailer titles, and user-entered shorthand names
- the repair eval set specifically scores the repair-facing interpretation layer, not just raw classifier actions, so reusable-parent safety can be tracked separately from generic classification quality
- new bottle families should add paired positive and negative examples whenever the wording is ambiguous enough to regress

## Internal Structure

The classifier is intentionally split into a few narrow modules:

- `classifier.ts` defines the narrow public classifier factory and public types.
- `contract.ts` defines the public request/response contract and normalized result artifacts.
- `classifierRuntime.ts` owns the reviewed orchestration boundary and the raw model/tool loop.
- `runtime/deterministic.ts` owns the pre-agent deterministic resolver registry.
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
