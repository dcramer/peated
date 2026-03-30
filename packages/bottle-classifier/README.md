# `@peated/bottle-classifier`

Generic bottle identity classifier for Peated.

This package takes a bottle reference such as a retailer listing, label OCR result, or user-entered bottle name and returns a reviewed bottle identity decision. It owns the extraction, prompt/tool orchestration, and deterministic post-processing needed to turn weak source text into a safe canonical result.

## Ownership

This package owns:

- the public classifier contract
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

Primary entrypoint:

```ts
classifyBottleReference({
  reference,
  extractedIdentity?,
  initialCandidates?,
});
```

The normal path is to pass only `reference`. The optional overrides exist for tests, evals, and cases where extraction or retrieval has already been done upstream.

## Behavioral Expectations

These are the rules to preserve when iterating on the classifier:

- Raw bottle references go in; reviewed bottle-centric decisions come out.
- False positive existing matches are worse than conservative `create_*` or `no_match` results.
- The model may only match candidate ids that were actually retrieved.
- Web evidence can support identity, but web search by itself is not canonical identity storage.
- Retailer wording and SEO noise are weak evidence; official and independent non-retailer sources are stronger.
- Over-specific local candidates should be downgraded if the listing does not support the extra differentiator.
- Generic `single cask` or `single barrel` wording is not enough for `exact_cask`.
- `exact_cask` should be reserved for strong marketed identity signals such as SMWS codes, cask numbers, or barrel numbers.
- If the parent bottle identity is clear and the new detail is release-level, prefer `create_release` over creating a whole new bottle.
- Downstream consumers should adapt the reviewed classifier result instead of re-sanitizing raw model output.
- Price-matching language such as `match_existing`, `correction`, and `create_new` does not belong in this package.

## File Map

- [`src/contract.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/contract.ts): public schemas and result helpers
- [`src/classifier.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.ts): orchestration boundary and tool loop
- [`src/classificationPolicy.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classificationPolicy.ts): deterministic review, normalization, scope inference, downgrades
- [`src/extractor.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/extractor.ts): bottle-label extraction
- [`src/instructions.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/instructions.ts): classifier and extractor prompts
- [`src/classifier.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.test.ts): policy-level unit coverage
- [`src/classifier.eval.fixtures.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.eval.fixtures.ts): production-shaped eval cases
- [`src/classifier.eval.test.ts`](/home/dcramer/src/peated/packages/bottle-classifier/src/classifier.eval.test.ts): live eval harness

## Iteration Workflow

When changing classifier behavior:

1. Update or add a focused unit test for deterministic behavior.
2. Update or add realistic positive and negative eval fixtures when the behavior is model-sensitive.
3. Keep prompts, schemas, and deterministic review logic aligned. Do not patch around package behavior in the server wrapper.
4. Re-run package tests and evals before touching downstream consumers.

Useful commands:

```bash
pnpm --filter @peated/bottle-classifier typecheck
pnpm --filter @peated/bottle-classifier test
pnpm --filter @peated/bottle-classifier evals
```

The eval command loads the repo-root `.env` and then `.env.local`. `OPENAI_API_KEY` is required. `OPENAI_MODEL` defaults to `gpt-5.4`. `BRAVE_API_KEY` is optional.

## Related Docs

- [`docs/architecture/bottle-classifier.md`](/home/dcramer/src/peated/docs/architecture/bottle-classifier.md)
- [`docs/features/store-price-matching.md`](/home/dcramer/src/peated/docs/features/store-price-matching.md)
- [`AGENTS.md`](/home/dcramer/src/peated/packages/bottle-classifier/AGENTS.md)
