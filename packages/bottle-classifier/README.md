# `@peated/bottle-classifier`

Generic bottle identity classifier for Peated.

This package takes a Bottle Reference such as a retailer listing, label OCR result, or user-entered Bottle name and returns a reviewed Bottle identity decision. It owns the extraction, prompt/tool orchestration, and deterministic post-processing needed to turn weak source text into a safe canonical result.

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
  normalizeProposedBottleDraft,
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
normalizeProposedBottleDraft(proposedBottle);
```

These are the package-owned pure helpers that downstream server code should
compose instead of re-implementing. They are the main low-cost surface for
deterministic edge-case tests. A create decision always describes one
independently complete Bottle.

Use the narrow subpath exports for specialized or internal-only surfaces:

```ts
import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { normalizeProposedBottleDraft } from "@peated/bottle-classifier/bottleCreationDrafts";
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
The controlled terms live in the
[`Bottle Classifier Glossary`](../../docs/architecture/bottle-classifier-glossary.md).
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
- [`src/releaseIdentity.ts`](./src/releaseIdentity.ts): canonical Bottle name and exact-trait normalization shared with staged migration consumers
- [`src/bottleCreationDrafts.ts`](./src/bottleCreationDrafts.ts): create-draft normalization
- [`src/priceMatchingEvidence.ts`](./src/priceMatchingEvidence.ts): shared evidence checks
- [`src/smws.ts`](./src/smws.ts): SMWS parsing and exact-code behavior
- [`src/eval-fixtures/`](./src/eval-fixtures): file-backed eval fixtures
- [`src/classifier.eval.test.ts`](./src/classifier.eval.test.ts): live classifier eval runner

## Iteration Workflow

When changing classifier behavior:

1. Inspect the trace from extraction through tools, agent output, review policy, and fixture expectation. A poor model query belongs to the prompt or tool description; a valid query that errors or returns malformed data belongs to the adapter or provider and is not negative evidence.
2. Update or add a focused unit test only for deterministic behavior.
3. Update or add the relevant file-backed eval fixtures when the behavior changes exact Bottle identity boundaries.
4. Update or add realistic positive and negative eval fixtures when the behavior is model-sensitive.
   When automation behavior matters, assert the code-derived `expected.expectedTier: auto | review`. The tier comes from action risk, unresolved risks, and structured evidence or deterministic anchors; it does not read model-supplied numeric scores.
5. Keep prompts, schemas, deterministic review logic, and pure normalization helpers aligned. Do not patch around package behavior in the server wrapper.
6. Do not solve one failed family by teaching the prompt that exact family name. Generalize the rule in prompt or policy, and use eval fixtures to hold the concrete regression.
7. Run package typecheck, focused unit tests, and fixture validation for routine changes. Use focused live evals while iterating and run the full live suite once at a deliberate checkpoint.

When adding an eval from a real production miss:

1. Start with the exact observed input: listing title, URL, extracted identity, local candidates, current assignment, and the failing classifier or automation outcome.
2. Web-verify the real bottle before writing the expected result. Prioritize producer/brand pages, official shops, independent whisky databases, competition records, reviews, and publications whose content specifically confirms the bottle traits. Treat retailer copy as the source listing, not proof by itself.
3. Decide the Peated DB outcome explicitly: exact `bottleId` or one complete Bottle creation, plus which source facts should remain observation-only. Historical release ids may remain in production provenance, but never enter classifier candidates or decisions. The classifier never creates a `bottle_release`, repairs a parent, or selects a BottleGroup.
4. Apply `docs/architecture/whisky-identity-model.md`: every marketed release must remain independently correct as a Bottle, including its supported exact traits; BottleGroup assignment is automatic downstream.
5. Encode the concrete regression, not a generalized pretend case. The fixture should name the real product, carry the real Peated ids or create expectation, and include `expected.expectedTier` when the automation outcome is part of the regression. Use `expected.verifyEligible` only when deliberately asserting the retained downstream existing-match verification compatibility projection; it is not the primary tier.
6. Add `provenance.source = "production_miss"` with `verifiedSourceUrls` and `dbOutcome` so future reviewers can see the web verification and the intended DB action without rediscovering it from memory.
7. If the family is ambiguous enough to regress in both directions, add paired positive and negative fixtures rather than a one-sided example.

During the flattening migration, fixture-only negative Bottle ids represent
historical release observations promoted to independently complete Bottle
candidates. They prevent those rows from being confused with real Peated
Bottle ids; the original positive release ids remain only in provenance.

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

Manual classifier smoke commands:

```bash
pnpm cli classifier run "Ardbeg Uigeadail"
pnpm cli classifier run --image /tmp/bottle.jpg
pnpm cli classifier run --input-file /tmp/classifier-input.json
```

The CLI uses the server adapters, local DB, and `.env.local` OpenAI config to
run the real classifier. Local image paths are sent to the extractor as data
URLs; public image URLs are passed through as image references.

Live eval commands:

```bash
# Baseline: GPT-5.6 Terra with medium reasoning
pnpm evals

# Compare GPT-5.6 Luna at an explicit effort
BOTTLE_CLASSIFIER_MODEL=gpt-5.6-luna \
  BOTTLE_CLASSIFIER_REASONING_EFFORT=high pnpm evals

pnpm --filter @peated/bottle-classifier evals
pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts

# Focused classifier quality-debt cases
pnpm evals:classifier:flaky
```

The focused command runs only these production-regression cases:

- `Rogues' Banquet: image-backed match and repair`
- `image-backed photo: matches and repairs Compass Box Spice Tree Extravaganza`
- `store listing: matches Laphroaig Càirdeas 2022 Warehouse 1 and merges the malformed duplicate`
- `audit: restore Pōkeno 2019 vintage without inferring a cask number`

Keep this list narrow: it is the fast iteration slice for known classifier
quality debt, not a replacement for the full live eval suite.

`pnpm evals` is the intended repo-root entrypoint. It forwards extra Vitest args
to the package runner and uses the `vitest-evals` reporter configured in
[`vitest.evals.config.mts`](./vitest.evals.config.mts).
The eval config loads the repo-root `.env.local`. Shell-provided environment
variables still take precedence.
`AI_GATEWAY_API_KEY` is required for hosted model calls. Production fails at
startup without it, and local evals skip when it is absent. All model calls use
Vercel AI Gateway. `BOTTLE_CLASSIFIER_MODEL` defaults to
`openai/gpt-5.6-terra` and `OPENAI_EVAL_MODEL` defaults to
`openai/gpt-5.6-luna`. The eval judge uses `medium` reasoning by default;
override it with
`OPENAI_EVAL_REASONING_EFFORT`.
`BOTTLE_CLASSIFIER_REASONING_EFFORT` accepts `none`, `low`, `medium`, `high`, or
`xhigh` for GPT-5 models and defaults to `medium`. The classifier sends the
resolved effort explicitly so production and eval baselines stay repeatable.
Reasoning tokens are included in output-token usage and billed as output tokens.
The eval metadata and visible usage annotation record the resolved effort. Image
extraction separately defaults to `gpt-5.6-luna` with
`high` reasoning; use `OPENAI_IMAGE_EXTRACTION_MODEL` and
`OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT` to override it. Image extraction
evals report their own token usage, estimated cost, and latency rather than
mixing those measurements into the classifier agent loop. `FIRECRAWL_API_KEY`
enables the classifier's live web search and focused page-reading tools;
`FIRECRAWL_API_URL` can override the default Firecrawl API host. Without the
key, the classifier has no web-evidence tools; it does not substitute an OpenAI
search-agent call.

The live evals use a `vitest-evals` harness around the same
`runBottleReference(...)` and `runBottleAudit(...)` entrypoints used in
production. The harness records model usage and real tool events, and replays
`firecrawl_web_search` and `firecrawl_read_page` when `FIRECRAWL_API_KEY`
enables those tools. A batched search consumes one configured search-budget
unit per query, and a page read consumes one unit.

Reported token usage and estimated USD cost cover the measured agent loop only.
The estimate uses the dated standard, short-context OpenAI rates recorded in the
harness metadata. The native eval summary shows total tokens, while one `usage`
annotation shows input tokens, output tokens, and estimated USD for each result.
Extraction, web-search tool fees, pre-agent work,
long-context pricing, alternate service tiers, and regional adjustments are not
included. Unknown models or unavailable usage omit the estimate rather than
reporting zero. Cache detail remains in structured usage metadata for pricing
accuracy rather than adding noise to the visible summary. Missing cache-token
detail is priced as standard input. Total timing is wall-clock time for the
complete production entrypoint.

Replay recordings default to the package-local upstream-style
`packages/bottle-classifier/.vitest-evals/recordings/` directory via
`VITEST_EVALS_REPLAY_DIR`. The normal commands above replay an existing
recording and record a new one on a miss automatically.
Replay JSON is reproducible eval evidence, not a disposable local cache. Review
and commit replay changes only when they are intentional.

Classifier eval CI publishes the native `vitest-evals` summary and a dedicated
`classifier eval score` Check Run. The check requires at least 80% of cases to
pass so isolated qualitative misses remain visible without hiding the suite's
aggregate signal. The workflow job also fails below that floor, so the gate does
not depend on branch-protection configuration. Missing or invalid Vitest result
reports are infrastructure failures and still fail the workflow job directly.

## Related Docs

- [`docs/architecture/bottle-classifier.md`](../../docs/architecture/bottle-classifier.md)
- [`docs/architecture/whisky-identity-model.md`](../../docs/architecture/whisky-identity-model.md)
- [`docs/features/store-price-matching.md`](../../docs/features/store-price-matching.md)
- [`AGENTS.md`](./AGENTS.md)
