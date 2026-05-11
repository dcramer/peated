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

The behavior spec lives in
[`docs/architecture/bottle-classifier.md`](../../docs/architecture/bottle-classifier.md).
Package-specific reminders:

- Keep price-matching proposal language out of this package.
- The model may only match candidate ids that were actually retrieved.
- Deterministic helpers must stay limited to structurally safe behavior.
- SMWS code references are deterministic; most other whisky-family semantics are not.
- Keep request-specific evidence in runtime input, tool results, schemas, and post-model validation.
- Use eval fixtures for concrete regressions instead of brand-specific prompt tutoring.

## File Map

- [`src/classifier.ts`](./src/classifier.ts): public classifier factory
- [`src/contract.ts`](./src/contract.ts): public request/result schemas
- [`src/classifierRuntime.ts`](./src/classifierRuntime.ts): orchestration and tool loop
- [`src/reviewPolicy.ts`](./src/reviewPolicy.ts): validation, normalization, and downgrades
- [`src/exactCaskPolicy.ts`](./src/exactCaskPolicy.ts): generic exact-cask signal validation for reviewed scope
- [`src/instructions.ts`](./src/instructions.ts): classifier and extractor prompts
- [`src/extractor.ts`](./src/extractor.ts): bottle-label extraction
- [`src/normalize.ts`](./src/normalize.ts): bottle/name/category/volume normalization
- [`src/releaseIdentity.ts`](./src/releaseIdentity.ts): bottle-versus-release identity helpers
- [`src/bottleCreationDrafts.ts`](./src/bottleCreationDrafts.ts): create-draft normalization
- [`src/priceMatchingEvidence.ts`](./src/priceMatchingEvidence.ts): shared evidence checks
- [`src/legacyReleaseRepairIdentity.ts`](./src/legacyReleaseRepairIdentity.ts): legacy release-repair discovery helpers
- [`src/legacyReleaseRepairResolution.ts`](./src/legacyReleaseRepairResolution.ts): repair-facing result interpretation
- [`src/smws.ts`](./src/smws.ts): SMWS parsing and exact-code behavior
- [`src/eval-fixtures/`](./src/eval-fixtures): file-backed eval fixtures
- [`src/classifier.eval.test.ts`](./src/classifier.eval.test.ts): live classifier eval runner
- [`src/legacyReleaseRepairResolution.eval.test.ts`](./src/legacyReleaseRepairResolution.eval.test.ts): live repair-boundary eval runner

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
