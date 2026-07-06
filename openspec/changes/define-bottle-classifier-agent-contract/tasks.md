## 1. Baseline And Contract Audit

- [x] 1.1 Freeze a baseline: run the full classifier evals on the untouched prompt, commit intentional recordings, and capture a per-action result breakdown. (2026-07-06: 71/76; match/corrections/repair/image 100%; all 5 failures in new-bottles creates, including an Ardbeg Traigh Bhan abstention that violates the existing anti-abstain rule.)
- [x] 1.2 Compare `packages/bottle-classifier/src/instructions.ts` against the `bottle-classifier-agent` requirements and list missing, duplicated, stale, or contradictory guidance.
- [x] 1.3 Produce the contradiction/override inventory: every rule pair that needs precedence language ("overrides", "however", "solely", "unless") to coexist, and the behavior each patch rule owns.
- [x] 1.4 Map every field the runtime serializes into the agent input envelope (`runtime/agentInput.ts`) to prompt-side semantics; list fields with no explanation (`hasExactAliasMatch`, `candidateExpansion`, `investigationHint`, `currentBottle`, preloaded `webEvidence`) and decide explain-or-remove for each.
- [x] 1.5 Produce the terminology mismatch list across prompt, tool schemas, output schema, and input envelope (for example `release` vs `bottling`, `dirty sibling rows`, `clean parent`) and the single glossary term for each concept.
- [x] 1.6 Map current output fields to the required output contract, including action ids, create drafts, `identityScope`, `aliasScope`, `identityBasis`, `confidenceBasis`, and `observation`.
- [x] 1.7 Value audit: for every input field, tool, output field, and runtime stage, name its consumer (code reference, review surface, or eval scorer) or mark it an ablation candidate; list removal candidates (known suspects: `candidateBottleIds`, `reference.id`, `rationale` consumers, `search_entities` usage rate, the no-match retry pass, preloaded web investigation).

## 2. Prompt Structure

- [x] 2.1 Reorder classifier instructions into task and success criteria, input map, bottle identity model, evidence policy and tool use, decision workflow, action semantics, and output contract as a pure-move pass; run focused evals against the baseline.
- [ ] 2.2 Write the input map covering the full envelope, including candidate field semantics for `kind`, `fullName`, `bottleFullName`, `releaseId`, and `familyContext`.
- [ ] 2.3 Consolidate in slices: fold precedence-override rules into the decision workflow order, remove duplicated prose and bottle-specific exceptions, and replace undefined jargon with glossary terms; run focused evals per slice with eval parity required.
- [ ] 2.4 Resolve the instruction/tool-surface mismatch for `candidateExpansion = initial_only` classification (instructions reference search tools that are not attached) and remove or use the dead options on `buildBottleClassifierInstructions`.
- [ ] 2.7 Replace `investigationHint` directive prose with structured retry/preload facts in the envelope (for example a pass indicator and prior-outcome field) explained by the input map, per the envelope-carries-facts requirement.
- [ ] 2.8 Strip no-value envelope fields per the value audit (`candidate.score`, `candidate.source`, `imageEvidence.textRegions`, `reference.id`); re-run focused evals to confirm no regression.
- [ ] 2.5 Preserve existing behavior unless the audit identifies a contradiction, stale schema reference, or missing first-principles rule.
- [ ] 2.6 If examples are added, hand-author diverse canonical cases per action whose concrete bottles are disjoint from eval fixtures, prioritizing create-naming cases.

## 3. Output Schema

- [ ] 3.1 Reorder the agent decision schema so `identityBasis`, `confidenceBasis`, and `rationale` precede `action`, target ids, and drafts; re-record replays and compare focused evals.
- [ ] 3.2 Design the typed-basis evolution (typed risk categories, source-locator evidence entries, typed trait placement) as separate eval-gated follow-ups; do not block prompt work on them.
- [ ] 3.3 Merge `identityBasis.uncertainties` into the typed `unresolvedRisks` list (one risk channel) and remove no-consumer observation subfields (`market`, `exclusive`, `outturn`) or land their first consumer, per the value audit.
- [ ] 3.4 Land the `identityBasis` trait-placement reader (releaseTraits must not leak into `proposedBottle.name`) so the basis object has a mechanical consumer; drop subfields the check proves unused.

## 4. Confidence Removal And Gating

- [ ] 4.1 Implement the code-derived automation tier for automated consumers from action risk, `unresolvedRisks`, `webEvidence`, exact-alias/current-assignment anchors, and deterministic anchors; `confidenceBasis.band` may only downgrade.
- [ ] 4.2 Migrate `priceMatchingEvidence.ts` numeric thresholds and `priceMatchingProposals.ts` consumers to the derived tier while numeric `confidence` is emitted but ignored.
- [ ] 4.3 Remove numeric `confidence` and `confidenceBasis.band` from the agent output schema, prompt, eval scorers, and fixtures in one revision; express the review veto as a typed unresolved risk, move current-assignment reaffirmation to positive evidence, and retire the review-policy caps that existed only to reconcile numeric confidence with the structured basis, and migrate deterministic band producers (`apps/server/src/agents/bottleClassifier/service.ts`, `smwsPolicy.ts`) to the derived tier.
- [ ] 4.4 Update `docs/architecture/bottle-classifier.md` eval guidance from confidence calibration to deterministic tier-derivation correctness.
- [x] 4.5 Implement the `aliasScope` write-time gate: alias-creating code paths read the asserted scope and refuse global aliases unless `global_alias` was asserted. (2026-07-06: scope persisted on proposals via migration 0191; gate at proposal approval marks non-`global_alias` listing aliases `ignored`; gate applies only to new/claimed alias rows and never mutates an existing assigned alias.)

## 5. Review Policy Boundary Audit

- [ ] 5.1 Audit `reviewPolicy.ts` transforms against the determinism boundary in `docs/architecture/bottle-classifier.md` (Review Policy Audit section); classify each transform as schema validation, closed-form gate, or second-classifier drift, and list drift candidates for removal or narrowing with eval proof.

## 6. Eval And Fixture Review

- [ ] 6.1 Review current classifier eval expectations for common-label bottle naming, release placement, exact-cask handling, source evidence, and alias-safety semantics.
- [ ] 6.2 Verify any changed production-miss expectation against real source evidence and the exact Peated DB outcome before editing the fixture.
- [ ] 6.3 Add or keep at least one non-identical validation case when a prompt change is motivated by a single fixture.
- [ ] 6.4 Add a per-action confusion breakdown to eval summaries that separates missed matches (false `no_match`) from false positives.
- [ ] 6.5 Commit intentional `.vitest-evals/recordings/**` replay changes generated by focused eval runs.
- [ ] 6.6 Run the candidate-presentation experiment: roughly ten ranked candidates with family siblings adjacent versus the current fifteen; adopt only with match-slice parity and no new-bottle recall regression.
- [ ] 6.7 Run the combined entity ablation: detach `search_entities` and disable entity preresolution, measuring proposed brand/distiller/bottler id fill-rate and sanitize survival on create/repair slices; keep, narrow, or remove based on results.
- [ ] 6.8 Run the no-match retry ablation: disable `shouldRetryNoMatchWithWebInvestigation` and score production-miss fixtures in both directions (recovered identities vs new false positives) before keeping or removing the pass.

## 7. Validation

- [ ] 7.1 Run `pnpm --filter @peated/bottle-classifier fixtures:validate`.
- [ ] 7.2 Run focused classifier evals for the touched behavior with `pnpm --filter @peated/bottle-classifier evals -- src/classifier.eval.test.ts`.
- [ ] 7.3 Summarize any eval regressions by separating prompt failures, fixture expectation errors, and review-policy or deterministic-gate issues.
