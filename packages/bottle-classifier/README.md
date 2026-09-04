# `@peated/bottle-classifier`

Shared whisky Bottle classification for Peated.

The [Bottle Classifier architecture](../../docs/architecture/bottle-classifier.md)
defines behavior and safety. This file covers the package boundary and how to
work with it.

## Ownership

This package owns:

- the public classification, extraction, and audit contracts;
- the model prompts, read-only tool loop, and result validation;
- pure Bottle identity and automation-tier helpers;
- classifier test cases, unit tests, and live evals.

Server code supplies database, local-search, and web functions. It owns saved
workflow state and any resulting database changes. This package must not import
`apps/server`.

## Public API

Create the reviewed classifier from the package root:

```ts
import {
  createBottleClassifier,
  createWhiskyLabelExtractor,
  formatCanonicalBottleName,
  getResolvedBottleIdentity,
  normalizeProposedBottleDraft,
} from "@peated/bottle-classifier";

const classifier = createBottleClassifier({ client, model, adapters });

const result = await classifier.classifyBottleReference({ reference });
const audit = await classifier.auditBottle({
  bottleId,
  origin: "moderator",
});
```

`classifyBottleReference` normally needs only `reference`. Callers that already
performed extraction or retrieval may also provide `extractedIdentity`,
`initialCandidates`, and `candidateExpansion`. Use `initial_only` when the agent
must stay within the supplied candidates.

The package root also exports the reviewed request and result schemas and types.
The `contract` subpath provides that contract without the classifier factory.

Use the normalization subpath for focused helpers:

```ts
import {
  normalizeBottleInput,
  normalizeBottleReferenceKey,
} from "@peated/bottle-classifier/normalize";
```

`normalizeBottleReferenceKey` is the safe helper for exact reference keys.
`normalizeBottleInput` performs wider display-name cleanup and structured fact
extraction; do not use it for an exact-reference decision. The old helper name
is fully removed, and legacy scraper integrations now call `normalizeBottleInput`.
See
[Bottle Reference Normalization](../../docs/architecture/bottle-reference-normalization.md).

Other supported subpaths include:

- `bottleCreationDrafts`
- `bottleIdentity`
- `bottleSchemaGuidance`
- `identityEvidenceCore`
- `imageEvidence`
- `openaiCompatibleConfig`
- `priceMatchingEvidence`
- `smws`

Server integrations may use only the explicit `internal/*` exports. These are not
general package API.

## File Map

- [`src/classifier.ts`](./src/classifier.ts) — public classifier factory
- [`src/contract.ts`](./src/contract.ts) — public request and result schemas
- [`src/classifierRuntime.ts`](./src/classifierRuntime.ts) — classifier and tool loop
- [`src/reviewPolicy.ts`](./src/reviewPolicy.ts) — final validation
- [`src/instructions.ts`](./src/instructions.ts) — classifier prompts
- [`src/extractor.ts`](./src/extractor.ts) — label extraction
- [`src/normalize.ts`](./src/normalize.ts) — normalization helpers
- [`src/bottleIdentity.ts`](./src/bottleIdentity.ts) — stable Bottle identity
- [`src/bottleCreationDrafts.ts`](./src/bottleCreationDrafts.ts) — creation draft cleanup
- [`src/priceMatchingEvidence.ts`](./src/priceMatchingEvidence.ts) — evidence checks and `deriveAutomationTier`
- [`src/smws.ts`](./src/smws.ts) — SMWS code handling
- [`src/eval-fixtures/`](./src/eval-fixtures) — file-backed eval cases
- [`src/classifier.eval.test.ts`](./src/classifier.eval.test.ts) — live eval runner
- [`evals/README.md`](./evals/README.md) — historical baselines and accuracy experiments

## Configuration

The server and eval runner read these settings:

| Setting                                      | Purpose                                          | Default           |
| -------------------------------------------- | ------------------------------------------------ | ----------------- |
| `AI_GATEWAY_API_KEY`                         | Required hosted model access                     | none              |
| `BOTTLE_CLASSIFIER_MODEL`                    | Reference and audit model                        | `gpt-5.6-luna`    |
| `BOTTLE_CLASSIFIER_REASONING_EFFORT`         | Classifier reasoning effort                      | `high`            |
| `OPENAI_IMAGE_EXTRACTION_MODEL`              | Label extraction model                           | `gpt-5.6-luna`    |
| `OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT`   | Label extraction reasoning effort                | `high`            |
| `OPENAI_EVAL_MODEL`                          | Eval judge model                                 | `gpt-5.6-luna`    |
| `OPENAI_EVAL_REASONING_EFFORT`               | Eval judge reasoning effort                      | `medium`          |
| `FIRECRAWL_API_KEY`                          | Optional web search and page reading             | none              |
| `FIRECRAWL_API_URL`                          | Optional Firecrawl endpoint override             | provider default  |
| `VITEST_EVALS_REPLAY_DIR`                    | Optional replay recording directory override     | package directory |
| `BOTTLE_CLASSIFIER_EVAL_FIXED_EVIDENCE_FILE` | Reviewed test case evidence for controlled evals | none              |
| `BOTTLE_CLASSIFIER_EVAL_FIXTURE_IDS`         | Comma-separated exact test case IDs to run       | all               |

Model calls use Vercel AI Gateway. Without Firecrawl, the classifier has no web
tools. The eval config loads the repo-root `.env.local`; shell values take
precedence.

## Commands

```bash
# Deterministic checks
pnpm --filter @peated/bottle-classifier terms:check
pnpm --filter @peated/bottle-classifier fixtures:validate
pnpm --filter @peated/bottle-classifier test
pnpm --filter @peated/bottle-classifier typecheck

# Live model checks
pnpm evals:classifier
pnpm evals:classifier:flaky
pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts

# Manual classifier smoke checks through server integrations and the local database
pnpm cli classifier run "Ardbeg Uigeadail"
pnpm cli classifier run --image /tmp/bottle.jpg
pnpm cli classifier run --input-file /tmp/classifier-input.json
```

`pnpm evals:classifier` runs classifier evals only. Root `pnpm evals` runs
classifier and scraper evals. Replay files under `.vitest-evals/recordings/` are
reviewable eval evidence; commit only intentional changes.

When behavior changes, add unit tests for deterministic rules and eval cases for
model judgment. Preserve the real input and verified result for a production
regression. Generalize the rule instead of adding a brand-specific prompt hint.

## Related Docs

- [Bottle Classifier](../../docs/architecture/bottle-classifier.md)
- [Bottle Reference Normalization](../../docs/architecture/bottle-reference-normalization.md)
- [Whisky Identity Model](../../docs/architecture/whisky-identity-model.md)
- [Store-price Matching](../../docs/architecture/store-price-matching.md)
- [Model Checks](../../docs/development/model-checks.md)
- [Package Instructions](./AGENTS.md)
