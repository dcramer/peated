# `@peated/bottle-classifier`

Generic bottle identity classifier for Peated.

This package takes a bottle reference such as a retailer listing, label OCR result, or user-entered bottle name and returns a reviewed bottle identity decision. It owns the extraction, prompt/tool orchestration, and deterministic post-processing needed to turn weak source text into a safe canonical result.

## Ownership

This package owns:

- the public classifier contract
- the shared bottle normalization corpus and classifier-facing eval fixtures
- whisky-specific extraction prompts and parsing
- the LLM reasoning loop, including local search, optional entity search, and web search
- deterministic review and downgrade policy
- exact-cask versus product-scope inference
- package-local unit tests and LLM-as-a-judge evals

This package does not own:

- database access
- HTTP clients for local bottle/entity search
- price-match proposal semantics
- persistence or automation decisions downstream of the reviewed classifier result

Server code should compose this package by injecting adapters. The package should not import `apps/server`.

## Public API

The package root is intentionally small. It should export only the core ways we classify and normalize bottle identity:

```ts
import {
  createBottleClassifier,
  createWhiskyLabelExtractor,
  formatCanonicalReleaseName,
  getResolvedReleaseIdentity,
  normalizeBottle,
  normalizeBottleCreationDrafts,
} from "@peated/bottle-classifier";
```

The main reviewed classifier boundary is:

```ts
const classifier = createBottleClassifier({ client, model, adapters });

await classifier.classifyBottleReference({
  reference,
  extractedIdentity?,
  initialCandidates?,
  candidateExpansion?,
});
```

The normal path is to pass only `reference`. The optional `extractedIdentity` and `initialCandidates` inputs exist for cases where extraction or retrieval has already been done upstream.
Set `candidateExpansion: "initial_only"` for closed-set review flows that must stay within the provided candidate set instead of searching for more bottles.

Deterministic normalization entrypoints:

```ts
normalizeBottle({ name, statedAge?, releaseYear?, ... });
normalizeBottleCreationDrafts({
  creationTarget?,
  proposedBottle?,
  proposedRelease?,
});
```

These are the package-owned pure helpers that downstream server code should
compose instead of re-implementing. They are the main low-cost surface for
corpus-driven edge-case tests.

Use the narrow subpath exports for specialized or internal-only surfaces:

```ts
import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { normalizeBottleCreationDrafts } from "@peated/bottle-classifier/bottleCreationDrafts";
import { deriveLegacyReleaseRepairIdentity } from "@peated/bottle-classifier/legacyReleaseRepairIdentity";
import { resolveLegacyCreateParentClassification } from "@peated/bottle-classifier/legacyReleaseRepairResolution";
import { BOTTLE_NORMALIZATION_CORPUS } from "@peated/bottle-classifier/normalizationCorpus";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
```

Additional pure helpers that are package-owned but not part of the root API:

- `@peated/bottle-classifier/priceMatchingEvidence`
- `@peated/bottle-classifier/smws`

Internal server adapters should import internals only through the explicit
`internal/*` namespace:

- `@peated/bottle-classifier/internal/runtime`
- `@peated/bottle-classifier/internal/types`
- `@peated/bottle-classifier/internal/extractor`
- `@peated/bottle-classifier/internal/prompts`
- `@peated/bottle-classifier/internal/policy`

The `contract` subpath remains public because it defines the reviewed request
and response boundary itself.

## Behavioral Expectations

These are the rules to preserve when iterating on the classifier:

- Raw bottle references go in; reviewed bottle-centric decisions come out.
- False positive existing matches are worse than conservative `create_*` or `no_match` results.
- When the safe outcome is still unresolved, return `no_match` instead of inventing a match or create action. Any follow-up review workflow belongs downstream.
- The model may only match candidate ids that were actually retrieved.
- Web evidence can support identity, but web search by itself is not canonical identity storage.
- Retailer wording and SEO noise are weak evidence; official and independent non-retailer sources are stronger.
- Unsupported novelty flavored-whiskey or whiskey-liqueur products should be rejected, but a flavor-adjacent noun in the expression is not enough by itself to exclude an otherwise valid whisky bottle.
- Over-specific local candidates should be downgraded if the listing does not support the extra differentiator.
- Generic `single cask` or `single barrel` wording is not enough for `exact_cask`.
- `exact_cask` should be reserved for strong marketed identity signals such as SMWS codes, cask numbers, or barrel numbers.
- If the parent bottle identity is clear and the new detail is release-level, prefer `create_release` over creating a whole new bottle.
- Downstream consumers should adapt the reviewed classifier result instead of re-sanitizing raw model output.
- Price-matching language such as `match_existing`, `correction`, and `create_new` does not belong in this package.
- Deterministic fast paths must stay limited to structurally safe behavior that is effectively zero-ambiguity.
- If the behavior depends on brand context, marketed family meaning, or program semantics, keep it classifier-owned.
- If the input is too sparse to safely infer a canonical bottle, block or return `no_match` instead of guessing.
- Prompt and extractor changes must encode transferable reasoning. Do not add brand-specific tutoring examples just to fix one observed family; keep those regressions in eval fixtures instead.

## File Map

- [`src/classifier.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.ts): narrow public classifier factory and types
- [`src/contract.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/contract.ts): public schemas and result helpers
- [`src/classifierRuntime.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifierRuntime.ts): internal orchestration boundary and tool loop, exposed to server adapters as `internal/runtime`
- [`src/classifierTypes.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifierTypes.ts): internal classifier working types and schemas, exposed to server adapters as `internal/types`
- [`src/classifierSchemas.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifierSchemas.ts): compatibility alias for `classifierTypes`
- [`src/reviewPolicy.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/reviewPolicy.ts): deterministic review, normalization, scope inference, downgrades, exposed to server adapters as `internal/policy`
- [`src/classificationPolicy.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classificationPolicy.ts): compatibility alias for `reviewPolicy`
- [`src/normalize.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/normalize.ts): pure bottle/name/category/volume normalization helpers
- [`src/releaseIdentity.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/releaseIdentity.ts): pure bottle-versus-release identity policy and canonical release naming helpers
- [`src/bottleSchemaRules.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/bottleSchemaRules.ts): compatibility alias for `releaseIdentity`
- [`src/bottleSchemaGuidance.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/bottleSchemaGuidance.ts): prompt-facing guidance text for bottle versus release identity
- [`src/bottleCreationDrafts.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/bottleCreationDrafts.ts): pure bottle versus release draft normalization helpers
- [`src/priceMatchingEvidence.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/priceMatchingEvidence.ts): pure price-matching evidence and conflict checks
- [`src/legacyReleaseRepairIdentity.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/legacyReleaseRepairIdentity.ts): pure legacy release-repair identity derivation and parent-match heuristics
- [`src/legacyReleaseRepairResolution.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/legacyReleaseRepairResolution.ts): pure repair-facing interpretation of reviewed classifier output
- [`src/smws.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/smws.ts): pure SMWS code, flavor-profile, and cask parsing helpers
- [`src/extractor.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/extractor.ts): bottle-label extraction, exposed to server adapters as `internal/extractor`
- [`src/instructions.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/instructions.ts): classifier and extractor prompts, exposed to server adapters as `internal/prompts`
- [`src/classifier.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.test.ts): policy-level unit coverage
- [`src/releaseIdentity.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/releaseIdentity.test.ts): package-local bottle versus release rule coverage
- [`src/normalize.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/normalize.test.ts): package-local normalization unit coverage
- [`src/bottleCreationDrafts.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/bottleCreationDrafts.test.ts): package-local draft normalization coverage
- [`src/priceMatchingEvidence.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/priceMatchingEvidence.test.ts): package-local price-matching evidence coverage
- [`src/legacyReleaseRepairIdentity.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/legacyReleaseRepairIdentity.test.ts): package-local release-repair identity coverage
- [`src/legacyReleaseRepairResolution.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/legacyReleaseRepairResolution.test.ts): package-local repair-resolution adapter coverage
- [`src/smws.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/smws.test.ts): package-local SMWS parsing coverage
- [`src/classifier.eval.fixtures.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.eval.fixtures.ts): production-shaped eval cases
- [`src/classifier.eval.scenarios.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.eval.scenarios.ts): scenario grouping for live classifier evals
- [`src/classifier.eval.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.eval.test.ts): live classifier eval harness grouped into `new bottles`, `match existing`, `corrections`, and `ignore or reject`
- [`src/normalizationCorpus.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/normalizationCorpus.ts): shared normalization corpus with expected bottle/release boundaries
- [`src/normalizationCorpus.eval.fixtures.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/normalizationCorpus.eval.fixtures.ts): curated normalization-boundary subset consumed by the `new bottles` live eval scenario
- [`src/legacyReleaseRepairResolution.eval.fixtures.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/legacyReleaseRepairResolution.eval.fixtures.ts): repair-boundary eval cases derived from the shared corpus and reusable-parent safety rules
- [`src/legacyReleaseRepairResolution.eval.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/legacyReleaseRepairResolution.eval.test.ts): live repair-boundary eval harness

## Iteration Workflow

When changing classifier behavior:

1. Update or add a focused unit test for deterministic behavior.
2. Update the normalization corpus when the behavior changes bottle versus release identity boundaries.
3. Update or add realistic positive and negative eval fixtures when the behavior is model-sensitive.
   Confidence calibration belongs here too: cases that should be safe for downstream auto-verification need explicit eval expectations for the high-confidence band, while review-only matches should stay below it.
4. Keep prompts, schemas, deterministic review logic, and pure normalization helpers aligned. Do not patch around package behavior in the server wrapper.
5. Do not solve one failed family by teaching the prompt that exact family name. Generalize the rule in prompt or policy, and use eval fixtures to hold the concrete regression.
6. Re-run package tests and evals before touching downstream consumers.

When adding a new bottle family or edge case:

- add both a positive and a negative example when the family is ambiguous enough to regress
- group those paired examples under a shared `contrastGroup` and use differing `contrastOutcome` values so corpus tests enforce the contrast
- mark whether the case is `deterministic_safe`, `classifier_required`, or `block_if_uncertain`
- record `peatedBottleIds` when the example came from a real Peated bottle page so future cleanup can trace back to the observed family
- opt into `liveEvalCoverage: "required"` only for ambiguous cases that are worth paid classifier validation, plus rare exact-cask observation-detail cases where we need to prove the classifier preserves the program code as canonical identity
- do not promote a variable semantic case into deterministic logic just to make a test pass

Useful commands:

```bash
pnpm evals
pnpm --filter @peated/bottle-classifier typecheck
pnpm --filter @peated/bottle-classifier test
pnpm --filter @peated/bottle-classifier evals
```

`pnpm evals` is the intended repo-root entrypoint. It forwards extra Vitest args
to the package runner and uses the `vitest-evals` reporter configured in
[`vitest.evals.config.mts`](/home/dcramer/src/peated/packages/bottle-classifier/vitest.evals.config.mts).
The eval command loads the repo-root `.env` and then `.env.local`.
`OPENAI_API_KEY` is required. `OPENAI_MODEL` defaults to `gpt-5.4` for the
classifier pass. `OPENAI_EVAL_MODEL` defaults to `gpt-5-mini` for judging so
routine evals stay cheaper by default; override either if you want a different
cost or quality tradeoff. `BRAVE_API_KEY` is optional.

Live evals now cache classifier web-search tool results under the committed
`packages/bottle-classifier/eval-cassettes/web-search/` directory so repeat
runs do not keep paying for the same real-world searches. Each search is stored
as its own JSON cassette under a tool-specific subdirectory. The default cache
mode is `replay_or_record`: replay an existing cassette if present, otherwise do
the live search once and record the normalized search evidence for later runs.
The cache writes canonical per-tool lookup keys and keeps replay compatibility
with older cassette keys so prompt/tool cleanup does not force mass cassette
regeneration just because incidental cache-key fields changed.

Useful cache controls:

- `pnpm evals:web-cache:clear` clears recorded cassette files while keeping the committed cache root
- `BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_MODE=replay_only` fails on a cache miss instead of hitting the network
- `BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_MODE=refresh` re-runs live searches and overwrites matching cassettes
- `BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_MODE=live` bypasses the cache completely
- `BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DIR=/custom/cache/dir` overrides the cassette directory

## Related Docs

- [`docs/architecture/bottle-classifier.md`](/home/dcramer/src/peated/docs/architecture/bottle-classifier.md)
- [`docs/features/store-price-matching.md`](/home/dcramer/src/peated/docs/features/store-price-matching.md)
- [`AGENTS.md`](/home/dcramer/src/peated/packages/bottle-classifier/AGENTS.md)
