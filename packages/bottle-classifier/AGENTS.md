# Agent Instructions

## Package Manager

Use `pnpm`: `pnpm --filter @peated/bottle-classifier typecheck`, `pnpm --filter @peated/bottle-classifier test`, `pnpm --filter @peated/bottle-classifier evals`

## File-Scoped Commands

| Task          | Command                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| Lint file     | `pnpm exec eslint packages/bottle-classifier/src/path/to/file.ts --fix`        |
| Format file   | `pnpm exec prettier --write packages/bottle-classifier/src/path/to/file.ts`    |
| Test one file | `pnpm --filter @peated/bottle-classifier test -- src/path/to/file.test.ts`     |
| Run eval file | `pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts` |

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
- Deterministic validation, downgrades, and `identityScope` rules live in `src/classificationPolicy.ts`.
- Prompt-only fixes are incomplete when the invariant is deterministic; fix policy and tests together.
- False positive existing matches are worse than conservative create or no-match results.
- `exact_cask` needs strong marketed identity signals such as SMWS codes, cask numbers, or barrel numbers.
- Behavior changes should update both unit tests and realistic eval fixtures when model-sensitive.
- Live evals load the repo-root `.env.local`.

## References

- See [`README.md`](/home/dcramer/src/peated/packages/bottle-classifier/README.md) for behavioral expectations.
- See [`docs/architecture/bottle-classifier.md`](/home/dcramer/src/peated/docs/architecture/bottle-classifier.md) for system-level context.
