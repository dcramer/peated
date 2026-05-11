# Agent Instructions

## Package Manager

Use `pnpm`: `pnpm --filter @peated/bottle-classifier typecheck`, `pnpm --filter @peated/bottle-classifier test`

## File-Scoped Commands

| Task                     | Command                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| Lint file                | `pnpm exec eslint packages/bottle-classifier/src/path/to/file.ts --fix`        |
| Format file              | `pnpm exec prettier --write packages/bottle-classifier/src/path/to/file.ts`    |
| Test one file            | `pnpm --filter @peated/bottle-classifier test -- src/path/to/file.test.ts`     |
| Run eval file when asked | `pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts` |

## Commit Attribution

AI commits MUST include:

```text
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Key Conventions

- Package owns generic bottle identity reasoning; server code only composes adapters.
- Do not import `apps/server` into this package.
- Keep price-match proposal semantics out of this package.
- Preserve the reviewed boundary in `src/contract.ts` and `src/classifier.ts`.
- Internal adapter-facing modules should stay behind the `internal/*` package namespace.
- Pre-agent deterministic resolvers live in `src/runtime/deterministic.ts`; only add a resolver when it is correct from closed syntax or curated reference data alone.
- Deterministic validation and downgrades live in `src/reviewPolicy.ts`; generic `identityScope` signal validation lives in `src/exactCaskPolicy.ts`.
- Bottle-versus-release semantics are model-led. Retrieval may expose sibling
  context, but do not encode brand/family-specific release splits in
  deterministic code.
- Post-model code may sanitize, normalize, reject, or downgrade unsafe output. It must not promote semantic actions such as `no_match` or `match` into create/repair outcomes based on whisky-family heuristics.
- Model-sensitive classification examples belong in eval fixtures. Unit tests should cover deterministic validation and post-processing invariants only.
- Keep the classifier system prompt static and cache-friendly. Dynamic facts belong in runtime input, tools, tool schemas, and validated output.
- Do not add brand-specific or eval-engineered prompt examples just to rescue one observed bottle family. Encode the transferable rule, and keep family-specific regressions in eval fixtures.
- Prompt-only fixes are incomplete when the invariant is deterministic; fix policy and tests together.
- Before adding deterministic whisky taxonomy, phrase, or category rules, use verified whisky research and cite the basis in code comments plus focused tests or fixtures. If the rule cannot be verified, leave the field unknown and let the web-enabled classifier reason about it.
- Brand/entity identity is not a prefix score; validate resulting canonical bottle/release names.
- False positive existing matches are worse than conservative create or no-match results.
- Bounded ambiguity should collapse to conservative `no_match` at this boundary. Downstream consumers own any review workflow.
- `exact_cask` needs strong marketed identity signals. SMWS codes are deterministic; other cask or barrel numbers still need classifier-reviewed evidence that the number is part of the marketed identity.
- Model-sensitive behavior changes should update realistic eval fixtures; add unit tests only for deterministic invariants changed to support them.
- Creation requires external web evidence. Never invent evidence or create without source support.
- Do not add critic, reviewer, database, or retailer domain allowlists for reviewed create decisions. Let the agent judge source quality from content, independence, specificity, and corroboration, then enforce only the reviewed confidence/evidence contract in code.
- Production-miss evals require the exact observed input, independent web verification of the real bottle, and an explicit Peated DB outcome before the expected result is encoded. Use fixture `provenance.source = "production_miss"` with `verifiedSourceUrls` and `dbOutcome`.
- Expected eval outcomes must name the exact Peated bottle/release ids, exact create action, and auto-verification expectation when those are known. Do not replace a production miss with a generalized or pretend outcome.
- Main classifier eval scoring is deterministic: encoded expected fields are required, unencoded optional enrichment is ignored, and LLM judges should not decide pass/fail for field-level expectations.
- Live evals are expensive; run full evals only when explicitly asked or when doing an intentional scoped eval pass.
- Replay JSON under `.vitest-evals/recordings/` is an eval artifact, not a local cache. Commit only deliberate replay changes tied to an eval fixture or harness change.
- Live evals load the repo-root `.env.local`.

## References

- `packages/bottle-classifier/README.md`
- `docs/architecture/bottle-classifier.md`
- `docs/architecture/whisky-identity-model.md`
- `docs/policies/agent-design.md`
- `docs/policies/code-comments.md`
