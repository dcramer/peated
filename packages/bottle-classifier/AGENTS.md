# Bottle Classifier

## Required Reading

Read before changing behavior:

- `packages/bottle-classifier/README.md`
- `docs/architecture/bottle-classifier.md`
- `docs/architecture/bottle-classifier-glossary.md`
- `docs/architecture/bottle-reference-normalization.md`
- `docs/architecture/whisky-identity-model.md`
- `docs/policies/agent-design.md`
- `docs/development/model-checks.md`

## Commands

| Task                    | Command                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| Typecheck package       | `pnpm --filter @peated/bottle-classifier typecheck`                            |
| Lint file               | `pnpm exec oxlint packages/bottle-classifier/src/path/to/file.ts --fix`        |
| Format file             | `pnpm exec prettier --write packages/bottle-classifier/src/path/to/file.ts`    |
| Test one file           | `pnpm --filter @peated/bottle-classifier test -- src/path/to/file.test.ts`     |
| Run a focused live eval | `pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts` |
| Check controlled terms  | `pnpm --filter @peated/bottle-classifier terms:check`                          |

## Boundaries

- This package owns Bottle identity reasoning. Server code owns adapters,
  storage, workflow proposals, and automation. No `apps/server` imports or
  price-matching storage logic here.
- Preserve `src/contract.ts` and `src/classifier.ts` boundaries; adapter internals
  stay under `internal/*`.
- Deterministic pre-model resolvers may supply verified identity anchors; the
  model decides marketed Bottle identity.
- Post-model code may validate schemas, reject impossible/unknown states,
  enforce explicit field contradictions, or downgrade unsafe results. Never
  upgrade model decisions or require agreement from fuzzy-name, search-rank,
  family, or brand-prefix heuristics.
- Research deterministic taxonomy, phrase, and category rules before adding
  them. Cite evidence in comments and focused tests; leave unverified fields
  unknown for the classifier to reason from evidence.

## Bottle Identity

- Each marketed release is a complete Bottle. Never select a Bottle Group or
  release-family owner.
- Bottle References are assigned, unresolved, or ignored source names. Only
  assigned references grant exact matches. Verified Bottle Aliases serve display
  and search, never exact matching.
- Bottle Reference Input means raw text, image, or URL for classification. It is
  not a Bottle Reference until accepted.
- Return `match`, `create_bottle`, or `no_match`. Required catalog corrections
  are separate Suggested Changes; return `no_match` until assignment is safe.
- Wrong existing matches are worse than conservative creation or `no_match`.
  Resolve bounded ambiguity to `no_match`.
- Creation may use reviewed source, label, image, catalog, or web evidence.
  Code-derived `expectedTier` needs corroboration or a verified identity anchor
  before `auto`.
- Judge sources by content, independence, specificity, and corroboration. No
  domain allowlists or brand-specific prompt tutoring.
- Preserve producer wording in `maturation`; no cask taxonomy. Put marketed cask
  IDs in `caskNumber`, stated bottle counts in `outturn`. Only marketed cask IDs
  can decide identity alone.

## Prompts and Evals

- Separate stable prompt policy from facts, evidence, tool schemas, and validated
  output.
- Tool spans: bounded public catalog/source evidence only. No private user data,
  credentials, image bytes, or full provider output.
- Use realistic eval fixtures for model behavior; unit/integration tests for
  schemas, validation, and post-processing.
- Fix deterministic rules in code and focused tests, not prompts alone.
- Preserve production-miss fixtures. Never patch prompts with their exact brand,
  family, or fixture wording. Prove the reusable rule with a separate case and
  different relevant values.
- Keep exact production-miss input; independently verify the Bottle online.
  Record `provenance.source = "production_miss"`, `verifiedSourceUrls`, and exact
  `dbOutcome`.
- Expected outcomes specify exact Bottle IDs, create actions, and `expectedTier`
  when known. Score identity fields deterministically, not with an LLM judge.
- Run focused live evals only for intentional model-sensitive work. Commit
  recordings required by deliberate fixture or harness changes.
- Live evals load root `.env.local`; shell variables take precedence.
