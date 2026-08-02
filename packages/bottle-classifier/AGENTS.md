# Agent Instructions

## Required Reading

Before changing classifier behavior, read:

- `packages/bottle-classifier/README.md`
- `docs/architecture/bottle-classifier.md`
- `docs/architecture/whisky-identity-model.md`
- `docs/policies/agent-design.md`
- `docs/policies/evals.md`

## Commands

| Task                    | Command                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| Typecheck package       | `pnpm --filter @peated/bottle-classifier typecheck`                            |
| Lint file               | `pnpm exec oxlint packages/bottle-classifier/src/path/to/file.ts --fix`        |
| Format file             | `pnpm exec prettier --write packages/bottle-classifier/src/path/to/file.ts`    |
| Test one file           | `pnpm --filter @peated/bottle-classifier test -- src/path/to/file.test.ts`     |
| Run a focused live eval | `pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts` |

## Package Boundary

- This package owns generic Bottle identity reasoning. Server code composes
  adapters and owns persistence, workflow-specific proposals, and automation.
- Do not import `apps/server` into this package or add price-matching persistence
  semantics here.
- Preserve the reviewed boundary in `src/contract.ts` and `src/classifier.ts`.
  Adapter-facing internals stay behind the `internal/*` package namespace.
- Pre-agent deterministic resolvers may decide only closed syntax or curated
  reference data. The model decides semantic marketed Bottle identity.
- Post-agent code may validate schemas, reject impossible or unknown states,
  enforce direct explicit-field contradictions, and downgrade unsafe output. It
  must not promote semantic actions or require fuzzy name, search-rank, family,
  or brand-prefix heuristics to agree with the model.
- Before adding deterministic whisky taxonomy, phrase, or category rules,
  verify the rule with whisky research and cite its basis in comments and
  focused coverage. If the rule cannot be verified, leave the field unknown and
  let the classifier reason from evidence.

## Bottle Identity

- Every marketed release is one independently complete Bottle. The classifier
  never selects a parent Bottle, BottleGroup, or release-family owner.
- Existing-Bottle identification and full canonical classification are separate
  contracts. `create_bottle` and `repair_bottle` require the full evidence bar.
- False-positive existing matches are worse than conservative creation or
  `no_match`. Bounded ambiguity resolves to `no_match` at this boundary.
- Creation may use reviewed source, label, image, local-catalog, or web evidence.
  Automatic verification needs corroboration or a closed-form identity anchor.
- Judge source quality from content, independence, specificity, and
  corroboration. Do not add domain allowlists or brand-specific prompt tutoring.
- `caskType`, `caskSize`, and `caskFill` are nullable compatibility metadata and
  never decide identity by themselves. Marketed finish wording, exact cask
  codes, `singleCask`, and `caskStrength` remain identity-critical.

## Prompts and Evals

- Keep stable prompt policy separate from dynamic facts, retrieved evidence,
  tool schemas, and validated output.
- Model-sensitive behavior belongs in realistic eval fixtures. Deterministic
  schemas, validation, and post-processing belong in unit or integration tests.
- A prompt-only fix is incomplete when the invariant is deterministic. Change
  the owning code policy and its focused tests together.
- Do not solve one production miss with its exact brand, family, or fixture
  wording in the prompt. Preserve the production fixture, encode the
  transferable rule, and prove it with a separate case that differs in the
  relevant concrete values.
- A production-miss fixture must preserve the exact observed input, independently
  verify the real Bottle online, and encode `provenance.source =
"production_miss"`, `verifiedSourceUrls`, and the exact `dbOutcome`.
- Expected outcomes name exact Bottle ids, create actions, and auto-verification
  expectations when known. Main field-level scoring remains deterministic; an
  LLM judge does not decide encoded identity fields.
- Live evals are expensive. Run focused live evals only for intentional
  model-sensitive work. Commit replay recordings required by deliberate fixture
  or harness changes.
- Live evals load repo-root `.env`/`.env.local`, then package-root equivalents;
  shell-provided environment variables take precedence.
