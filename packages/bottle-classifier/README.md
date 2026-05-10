# `@peated/bottle-classifier`

Generic bottle identity classifier for Peated.

This package takes a bottle reference such as a retailer listing, label OCR result, or user-entered bottle name and returns a reviewed bottle identity decision. It owns the extraction, prompt/tool orchestration, and deterministic post-processing needed to turn weak source text into a safe canonical result.

## Ownership

This package owns:

- the public classifier contract
- file-backed classifier eval fixtures and their validation
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
deterministic edge-case tests.

Use the narrow subpath exports for specialized or internal-only surfaces:

```ts
import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { normalizeBottleCreationDrafts } from "@peated/bottle-classifier/bottleCreationDrafts";
import { deriveLegacyReleaseRepairIdentity } from "@peated/bottle-classifier/legacyReleaseRepairIdentity";
import { resolveLegacyCreateParentClassification } from "@peated/bottle-classifier/legacyReleaseRepairResolution";
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
- `exact_cask` should be reserved for strong marketed identity signals. SMWS codes are deterministic; other cask or barrel numbers still need reviewed evidence that the number is part of the marketed identity.
- If the parent bottle identity is clear and the new detail is release-level, prefer `create_release` over creating a whole new bottle.
- Downstream consumers should adapt the reviewed classifier result instead of re-sanitizing raw model output.
- Price-matching language such as `match_existing`, `correction`, and `create_new` does not belong in this package.
- Deterministic fast paths must stay limited to structurally safe behavior that is effectively zero-ambiguity.
- If the behavior depends on brand context, marketed family meaning, or program semantics, keep it classifier-owned.
- If the input is too sparse to safely infer a canonical bottle, block or return `no_match` instead of guessing.
- Post-model review code may sanitize, normalize, reject, or downgrade unsafe output. It should not promote a semantic action into a different create/repair/match action based on family-specific heuristics.
- The classifier system prompt should stay static. Request-specific evidence belongs in runtime input, tool results, schemas, and post-model validation.
- Prompt and extractor changes must encode transferable reasoning. Do not add brand-specific tutoring examples just to fix one observed family; keep those regressions in eval fixtures instead.

## File Map

- [`src/classifier.ts`](./src/classifier.ts): narrow public classifier factory and types
- [`src/contract.ts`](./src/contract.ts): public schemas and result helpers
- [`src/classifierRuntime.ts`](./src/classifierRuntime.ts): internal orchestration boundary and tool loop, exposed to server adapters as `internal/runtime`
- [`src/classifierTypes.ts`](./src/classifierTypes.ts): internal classifier working types and schemas, exposed to server adapters as `internal/types`
- [`src/classifierSchemas.ts`](./src/classifierSchemas.ts): compatibility alias for `classifierTypes`
- [`src/reviewPolicy.ts`](./src/reviewPolicy.ts): deterministic review, normalization, scope inference, downgrades, exposed to server adapters as `internal/policy`
- [`src/classificationPolicy.ts`](./src/classificationPolicy.ts): compatibility alias for `reviewPolicy`
- [`src/normalize.ts`](./src/normalize.ts): pure bottle/name/category/volume normalization helpers
- [`src/releaseIdentity.ts`](./src/releaseIdentity.ts): pure bottle-versus-release identity policy and canonical release naming helpers
- [`src/bottleSchemaRules.ts`](./src/bottleSchemaRules.ts): compatibility alias for `releaseIdentity`
- [`src/bottleSchemaGuidance.ts`](./src/bottleSchemaGuidance.ts): prompt-facing guidance text for bottle versus release identity
- [`src/bottleCreationDrafts.ts`](./src/bottleCreationDrafts.ts): pure bottle versus release draft normalization helpers
- [`src/priceMatchingEvidence.ts`](./src/priceMatchingEvidence.ts): pure price-matching evidence and conflict checks
- [`src/legacyReleaseRepairIdentity.ts`](./src/legacyReleaseRepairIdentity.ts): pure legacy release-repair identity derivation and parent-match heuristics
- [`src/legacyReleaseRepairResolution.ts`](./src/legacyReleaseRepairResolution.ts): pure repair-facing interpretation of reviewed classifier output
- [`src/smws.ts`](./src/smws.ts): pure SMWS code, flavor-profile, and cask parsing helpers
- [`src/extractor.ts`](./src/extractor.ts): bottle-label extraction, exposed to server adapters as `internal/extractor`
- [`src/instructions.ts`](./src/instructions.ts): classifier and extractor prompts, exposed to server adapters as `internal/prompts`
- [`src/classifier.test.ts`](./src/classifier.test.ts): policy-level unit coverage
- [`src/releaseIdentity.test.ts`](./src/releaseIdentity.test.ts): package-local bottle versus release rule coverage
- [`src/normalize.test.ts`](./src/normalize.test.ts): package-local normalization unit coverage
- [`src/bottleCreationDrafts.test.ts`](./src/bottleCreationDrafts.test.ts): package-local draft normalization coverage
- [`src/priceMatchingEvidence.test.ts`](./src/priceMatchingEvidence.test.ts): package-local price-matching evidence coverage
- [`src/legacyReleaseRepairIdentity.test.ts`](./src/legacyReleaseRepairIdentity.test.ts): package-local release-repair identity coverage
- [`src/legacyReleaseRepairResolution.test.ts`](./src/legacyReleaseRepairResolution.test.ts): package-local repair-resolution adapter coverage
- [`src/smws.test.ts`](./src/smws.test.ts): package-local SMWS parsing coverage
- [`src/classifier.eval.fixtures.ts`](./src/classifier.eval.fixtures.ts): production-shaped eval cases
- [`src/evalFixtureSchemas.ts`](./src/evalFixtureSchemas.ts): shared schemas and file walkers for JSON-backed eval fixtures
- [`src/classifier.eval.scenarios.ts`](./src/classifier.eval.scenarios.ts): scenario grouping for live classifier evals
- [`src/classifier.eval.test.ts`](./src/classifier.eval.test.ts): OpenAI Agents harness-backed live classifier evals grouped into `new bottles`, `match existing`, and `corrections`
- [`src/eval-fixtures/new-bottles/`](./src/eval-fixtures/new-bottles): real-world new-bottle listing fixtures, one JSON file per case
- [`src/eval-fixtures/decision-cases/`](./src/eval-fixtures/decision-cases): decision-shape workflow fixtures grouped by scenario
- [`src/eval-fixtures/legacy-release-repair/`](./src/eval-fixtures/legacy-release-repair): repair-boundary fixtures, one JSON file per case
- [`src/evalFixtures.validate.test.ts`](./src/evalFixtures.validate.test.ts): explicit schema and invariants validation for all file-backed fixtures
- [`src/legacyReleaseRepairResolution.eval.fixtures.ts`](./src/legacyReleaseRepairResolution.eval.fixtures.ts): file-backed repair-boundary eval loader
- [`src/legacyReleaseRepairResolution.eval.test.ts`](./src/legacyReleaseRepairResolution.eval.test.ts): OpenAI Agents harness-backed live repair-boundary evals

## Iteration Workflow

When changing classifier behavior:

1. Update or add a focused unit test only for deterministic behavior.
2. Update or add the relevant file-backed eval fixtures when the behavior changes bottle versus release identity boundaries.
3. Update or add realistic positive and negative eval fixtures when the behavior is model-sensitive.
   Confidence calibration belongs here too: cases that should be safe for downstream auto-verification need explicit eval expectations for the high-confidence band, while review-only matches should stay below it.
4. Keep prompts, schemas, deterministic review logic, and pure normalization helpers aligned. Do not patch around package behavior in the server wrapper.
5. Do not solve one failed family by teaching the prompt that exact family name. Generalize the rule in prompt or policy, and use eval fixtures to hold the concrete regression.
6. Run package typecheck, focused unit tests, and fixture validation for routine changes. Run live evals only when explicitly requested or when doing an intentional scoped eval pass.

When adding an eval from a real production miss:

1. Start with the exact observed input: listing title, URL, extracted identity, local candidates, current assignment, and the failing classifier or automation outcome.
2. Web-verify the real bottle before writing the expected result. Prioritize producer/brand pages, official shops, independent whisky databases, competition records, reviews, and publications whose content specifically confirms the bottle traits. Treat retailer copy as the source listing, not proof by itself.
3. Decide the Peated DB outcome explicitly: exact `bottleId`, exact `releaseId` or `null`, whether a `bottle_release` should be created, whether a parent split is required, and which source facts should remain observation-only.
4. Apply `docs/architecture/whisky-identity-model.md`: bottle-first when the product identity is clear, release only for reusable canonical variants, and preserve exact listing details as observations when they are not canonical identity.
5. Encode the concrete regression, not a generalized pretend case. The fixture should name the real product, carry the real Peated ids or create expectation, and include `expected.confidenceBand` / `expected.verifyEligible` when downstream automation depends on the confidence band.
6. Add `provenance.source = "production_miss"` with `verifiedSourceUrls` and `dbOutcome` so future reviewers can see the web verification and the intended DB action without rediscovering it from memory.
7. If the family is ambiguous enough to regress in both directions, add paired positive and negative fixtures rather than a one-sided example.

When adding a new bottle family or edge case:

- add both a positive and a negative example when the family is ambiguous enough to regress
- mark whether the case is `deterministic_safe`, `classifier_required`, or `block_if_uncertain`
- keep one listing per JSON file under the appropriate `src/eval-fixtures/*` directory
- record `peatedBottleIds` for real-world new-bottle fixtures so future cleanup can trace back to the observed family
- do not promote a variable semantic case into deterministic logic just to make a test pass

Useful commands:

```bash
pnpm --filter @peated/bottle-classifier fixtures:validate
pnpm --filter @peated/bottle-classifier typecheck
pnpm --filter @peated/bottle-classifier test
```

Live eval commands:

```bash
pnpm evals
pnpm --filter @peated/bottle-classifier evals
```

`pnpm evals` is the intended repo-root entrypoint. It forwards extra Vitest args
to the package runner and uses the `vitest-evals` reporter configured in
[`vitest.evals.config.mts`](./vitest.evals.config.mts).
The eval config loads the repo-root `.env` and then `.env.local`, with later
files overriding earlier ones. Shell-provided env vars still take precedence.
`OPENAI_API_KEY` is required. `OPENAI_MODEL` defaults to `gpt-5.4` for the
classifier pass. `OPENAI_EVAL_MODEL` defaults to `gpt-5-mini` for judging so
routine evals stay cheaper by default; override either if you want a different
cost or quality tradeoff. `BRAVE_API_KEY` is optional.

The live evals use `vitest-evals` harness-style `run(...)` tests with
`@vitest-evals/harness-openai-agents` normalization, native harness
`toolReplay`, and named judges. The classifier opts `openai_web_search` and
`brave_web_search` into replay at the harness boundary so repeat runs do not
keep paying for the same real-world searches.

Replay recordings default to the package-local upstream-style
`packages/bottle-classifier/.vitest-evals/recordings/` directory via
`VITEST_EVALS_REPLAY_DIR`. `VITEST_EVALS_REPLAY_MODE` defaults to `auto`, which
replays an existing recording and records a new one on a miss. Set it to
`strict`, `record`, or `off` to use the upstream `vitest-evals` replay modes.
Replay JSON is reproducible eval evidence, not a disposable local cache. Review
and commit replay changes only when they are intentional.

## Related Docs

- [`docs/architecture/bottle-classifier.md`](../../docs/architecture/bottle-classifier.md)
- [`docs/architecture/whisky-identity-model.md`](../../docs/architecture/whisky-identity-model.md)
- [`docs/features/store-price-matching.md`](../../docs/features/store-price-matching.md)
- [`AGENTS.md`](./AGENTS.md)
