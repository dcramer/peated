## Context

The classifier exists to answer one question: given an observed whisky bottle reference, what catalog identity should Peated trust enough to match, create, repair, or reject?

The agent sits inside a fixed flow shape shared by Add Bottle, price scraping, and review ingestion:

1. Input is a bottle label (text) or an image.
2. A deterministic exact-alias fast path may resolve the reference without the agent.
3. Otherwise the agent decides the identity outcome.
4. Deterministic code brackets the agent under one principle: identity anchors run before the agent (exact alias, SMWS exact-cask codes — closed identifier schemes that can skip the agent entirely), presentation normalization runs after it. Neither competes with agent judgment.
5. Review gating is consumer policy, not agent contract: Add Bottle is user-driven and needs no gate; automated flows send work to review only when there is no clear match or no confidence in the evidence.

That question has to be answered from first principles, not from prompt folklore or individual eval fixtures:

1. Raw source text is evidence, not canonical identity.
2. The observed bottle identity comes before the database outcome.
3. Local Peated candidates are prior art, not instructions.
4. Web and source evidence can support identity, but cannot launder vague input into canonical truth.
5. Bottle, release, exact-cask, and observation facts are different precision layers.
6. Common user-recognizable bottle labels are the create target; every observed fact does not belong in the bottle name.
7. The model owns semantic whisky judgment; code owns validation, permissions, persistence, and irreversible gates.
8. The output contract must be structured enough that review policy and evals can reject unsafe decisions without becoming a second classifier.

The current prompt contains useful domain guidance, but edits have become hard to reason about because field semantics, bottle/release modeling, evidence policy, action semantics, and examples are interleaved. The output schema also has fields whose intended use is not obvious from names alone, such as `fullName`, `bottleFullName`, `kind`, `familyContext`, `identityBasis`, `confidenceBasis`, `identityScope`, and `aliasScope`.

## Goals / Non-Goals

**Goals:**

- Define the stable classifier-agent contract separately from the exact wording of `instructions.ts`.
- Make the prompt layout predictable: task, input map, bottle model, evidence rules, decision workflow, action semantics, output contract, and examples.
- Keep prompt prose low and avoid repeating the same rule in competing sections.
- Preserve model judgment for whisky identity while keeping persistence, schema validation, and automation gates in code.
- Make web/source evidence a first-class evidence concept without requiring web evidence for every local match.
- Make evals the validation gate for prompt changes, fixture expectation changes, and output-schema semantics.
- Remove numeric `confidence` from the agent contract and derive automation gating in consumer code from structured evidence.
- Consolidate accreted rule-with-override prose into an ordered decision workflow instead of preserving it reordered.

**Non-Goals:**

- Do not rewrite the classifier prompt as part of defining the OpenSpec.
- Do not introduce a new model, tool, table, or runtime loop.
- Do not add deterministic whisky-family heuristics for brand, age, year, batch, cask, barrel, or release modeling.
- Do not resolve unrelated store-price persistence or source-scoped alias implementation details beyond the agent-facing contract.
- Do not change the runtime loop, tool set, or model as part of this change.

## Decisions

### Decision: Specify the agent contract before changing instructions

The OpenSpec capability defines what the agent must do and what the prompt must communicate. Implementation work can then reorganize `instructions.ts` to satisfy the contract and use evals to compare behavior.

Alternative considered: directly patch prompt prose and use evals as the only contract. Rejected because evals are incomplete by design and can encourage overfitting when the underlying input and output semantics are not explicit.

### Decision: Keep one full classifier agent contract

This change documents the existing full classifier agent contract, not a separate local-only identification agent. The full classifier can use local candidates, entities, and web evidence, and can return match, repair, create, and no-match actions.

Alternative considered: specify local identification and full classification together. Rejected for this change because local identification has a narrower tool and action surface. It should remain referenced as a separate contract in the architecture docs until it receives its own implementation spec.

### Decision: Organize prompt instructions by responsibility

The prompt should use stable section headers in this order:

1. Task and success criteria
2. Input map
3. Bottle identity model
4. Evidence policy and tool use
5. Decision workflow
6. Action semantics
7. Output contract
8. Short examples or edge-case notes (optional)

Rationale: modern instruction-following models perform better when the objective, constraints, data model, and output contract are separated. This order also keeps dynamic input interpretation before action selection and prevents examples from becoming the primary policy.

Reorganization is not enough on its own. The current prompt has accreted roughly ninety rules, including explicit precedence patches such as "this existing-target rule overrides clean-parent modeling". Contradictory or override-style rule pairs measurably degrade reasoning-model behavior, instruction adherence decays with rule density, and earlier rules dominate later ones. Any rule that needs precedence language to coexist with another rule must be folded into the ordered decision workflow so the ordering itself expresses the precedence. The audit must produce a contradiction/override inventory, and consolidation must reduce rule count with eval parity per slice.

Examples are optional, not required. If examples are added they must be a small set of diverse canonical cases per action, not brand-specific case law; edge cases belong in eval fixtures. The extractor prompt's retailer example list is out of scope for this capability but carries the same case-law risk and should be dieted in a follow-up.

Alternative considered: keep one long rule list with examples interleaved. Rejected because it hides contradictions and makes it hard to tell which rule owns a behavior.

Alternative considered: reorder the existing rules without consolidating them. Rejected because the risk in prompt edits comes from rule accretion and precedence patches, not from section placement alone.

### Decision: Treat local candidates as evidence, not target instructions

Local candidates answer whether Peated already has the observed identity and how nearby records are modeled. They do not erase source identity and they do not prove a match through rank, similarity, or prefix overlap.

The prompt must explain candidate fields:

- `kind = bottle` is a parent bottle candidate.
- `kind = release` is a child release candidate.
- `fullName` is the candidate display string for that candidate, which may include release text.
- `bottleFullName` is the parent bottle display string when the candidate is a release.
- `releaseId` identifies a child release and must be paired with the parent `bottleId`.
- `familyContext` describes nearby siblings and legacy parent traits that help decide bottle versus release scope.

The input map must cover the whole agent input envelope, not only candidate fields. Today the envelope also carries `hasExactAliasMatch`, `candidateExpansion`, `investigationHint`, `currentBottle`, and preloaded `webEvidence`, and none of them are explained to the model. Every field the runtime serializes into the agent input must have prompt-side semantics or be removed from the envelope; unexplained fields are noise the model can only misread.

Terminology must be consistent across the prompt, tool schemas, output schema, and input envelope. The current prompt mixes `release` and `bottling` for the same concept and introduces prompt-only phrases such as "dirty sibling rows" and "clean parent" without definitions. The bottle identity model section owns the glossary: each term is defined once, matches the schema field names where one exists, and other sections reuse the defined term instead of a synonym.

Alternative considered: rely on schema descriptions only. Rejected because the model sees both prompt and schema but schema descriptions are too terse to teach cross-field identity semantics.

### Decision: Instructions stay static and consistent with the tool surface

The classifier prompt must remain static per instruction mode so provider-side prompt caching works and runtime facts stay in the input, tools, and validation. That guardrail currently lives only in a code comment; it becomes contract.

The static rule also closes the data-channel loophole: the runtime currently injects per-run directive prose through the `investigationHint` envelope field (two different instruction paragraphs for the preloaded-evidence and no-match-retry passes). Per-run state must be expressed as structured facts the input map explains, never as freeform instructions inside the data.

Each instruction mode must also match the tools actually attached in that mode. Today `candidateExpansion = initial_only` classification runs the full prompt, which instructs web and local search, with no tools attached. Either the mode gets instructions that reflect its tool surface, or the input map must define how the model should behave when a referenced tool is absent.

Alternative considered: branch the prompt dynamically per run. Rejected because it breaks caching and moves runtime facts into instructions.

### Decision: Make web/source evidence supportive but not mandatory

The agent should prefer supportive web/source evidence for create, repair, release, and uncertain local-match decisions. Web evidence is not required for every clear existing match when label/image evidence, exact accepted local evidence, or a closed-form deterministic anchor is sufficient.

Alternative considered: require web evidence for all accepted outcomes. Rejected because it would downgrade clear local/image matches and make web availability a correctness dependency instead of an evidence source.

### Decision: Remove numeric confidence; consumers derive gating from evidence

Numeric `confidence` is removed from the agent output contract. The agent's job ends at the identity outcome: `action`, target ids or create drafts, `identityBasis`, and `confidenceBasis` evidence fields (`positiveEvidence`, `unresolvedRisks`, `webEvidence`, `toolsUsed`). Verbalized numeric self-confidence is systematically overconfident and adds a second channel that can disagree with the structured decision, which is why review policy has grown reconciliation caps whose only job is to referee that disagreement.

Whether a decision needs human review is consumer policy, derived in code:

- Add Bottle is user-driven; the user confirms the outcome, so no automation tier applies.
- Automated flows (price scraping, ingestion) derive an automation tier from action risk plus the asserted evidence: a clear existing match or well-supported create with no unresolved risks can act automatically; anything else goes to review.
- `confidenceBasis.band` is removed along with the numeric score. The model's holistic "something feels off" judgment is expressed as a typed unresolved risk (category plus note), so every veto carries a reason the review queue can sort on. Risks can only force review; no agent-asserted field can upgrade a decision the derived gate routes to review.

Deriving the tier from structured fields is closed-form gating, which the determinism policy already allows; it is not whisky-family semantics.

Alternative considered: keep numeric confidence as a secondary signal. Rejected because two confidence channels require permanent reconciliation caps and the numeric channel carries no information the structured fields lack.

Alternative considered: tune numeric confidence thresholds in the prompt. Rejected because numeric scores are unstable across model families and easier to overfit than explicit evidence categories.

### Decision: Output schema orders evidence before the action

Structured output is generated in schema field order. The agent decision schema must place `identityBasis`, `confidenceBasis`, and `rationale` before `action`, target ids, and drafts so the model commits to evidence before committing to the decision. This is a schema-shape requirement with eval-visible effects, so it lands with re-recorded replays and before-vs-after comparison.

### Decision: Schema attributes may be redesigned toward verifiability

No existing attribute is grandfathered. Because gating moves to code, the basis fields become load-bearing, and freeform string arrays are a weak foundation for deterministic gates. The preferred evolution, staged behind evals:

- `unresolvedRisks` entries gain a typed category plus a note, so "no material risk" is a category check, not an empty-array check on prose.
- `positiveEvidence` entries gain a source kind and locator, so validation can confirm each citation against the run's collected artifacts (search evidence URLs, candidate ids, image evidence) and reject fabricated support.
- `identityBasis` trait lists move from freeform strings to typed trait fields with values, aligned with the existing `traitFields` vocabulary on candidates, so bottle-versus-release placement is mechanically checkable by evals and review policy.

These are larger changes than the prompt reorganization and must not block it; each lands separately with re-recorded replays. The action enum stays: compound actions such as `create_bottle_and_release` keep the action set explicit and mutually exclusive, which is safer than orthogonal axes that allow invalid combinations.

Alternative considered: keep all basis fields freeform and let review policy parse prose. Rejected because prose parsing is exactly the second-classifier drift the determinism boundary forbids.

### Decision: Common-label output naming is the core create goal

For proposed bottles, `proposedBottle.name` should be the common bottle label identity users would recognize, not a maximal dump of every observed fact. Stable bottle-level identity belongs in the bottle draft; reusable release identity belongs in the release draft; exact source facts that are not shared canon belong in `observation`.

Alternative considered: include all age, year, ABV, batch, cask, and finish text in bottle names to avoid losing detail. Rejected because that creates dirty parent bottles and bypasses the bottle/release/observation model.

### Decision: Evals validate behavior and guard against overfitting

Prompt changes should run focused classifier evals and fixture validation. Production-miss fixtures must preserve observed inputs, verified source URLs, and exact Peated DB outcomes. When a prompt change is motivated by one miss, add or keep a generalized case that differs in concrete bottle details so the rule is not only tuned to the motivating fixture.

Alternative considered: accept eval improvements case by case without provenance. Rejected because incorrect fixture expectations can hide regressions and overfitting.

## Risks / Trade-offs

- Spec duplicates architecture docs -> Keep the OpenSpec focused on agent-facing SHALL/MUST behavior and reference architecture docs for broader runtime ownership.
- Prompt cleanup may change model behavior even without schema changes -> Freeze a full eval baseline before any edit, then run fixture validation and focused classifier evals per slice.
- Consolidating rules can silently drop a behavior a patch rule was carrying -> The contradiction/override inventory names the behavior each patch rule owns before it is folded into the workflow, and eval parity is required per slice.
- Web evidence wording could make the agent over-search -> Require web use only when needed for create, repair, release, or uncertainty, and score tool use in `confidenceBasis.toolsUsed`.
- Common-label naming can become subjective -> Validate with evals that check bottle, release, and observation placement instead of comparing prose rationale.
- Removing numeric confidence breaks existing consumers -> Stage the migration: consumers move to the derived tier while the numeric field is emitted but ignored, then the field is deleted from the agent schema. Stored proposal columns remain as historical telemetry.
- Heavy review policy absorbs prompt errors and muddies eval attribution -> Audit `reviewPolicy.ts` transforms against the determinism boundary in `docs/architecture/bottle-classifier.md` and separate gate failures from prompt failures in eval summaries.

## Migration Plan

1. Approve this OpenSpec contract.
2. Freeze a baseline: full classifier eval run on the untouched prompt with committed recordings and a per-action result breakdown.
3. Audit `instructions.ts` against the contract without changing behavior, producing the input-map gap list, the terminology mismatch list, and the contradiction/override inventory.
4. Reorder prompt prose into the specified sections as a pure-move pass; run focused evals and compare to baseline.
5. Consolidate rules in slices: fold precedence-override rules into the decision workflow, remove duplicates, and cut prompt-only jargon or define it in the glossary; run focused evals per slice with eval parity required.
6. Reorder the agent output schema so basis fields precede the action; re-record replays and compare.
7. Migrate automation consumers from numeric confidence to the code-derived tier (numeric emitted but ignored; band treated as downgrade-only during the interim), then remove `confidence` and `confidenceBasis.band` from the agent schema, eval scorers, and fixtures, expressing the review veto as a typed unresolved risk.
8. Add or update eval fixture expectations only when provenance proves the expected Peated outcome is correct.
9. Run `pnpm --filter @peated/bottle-classifier fixtures:validate` and focused classifier evals; commit intentional replay recordings.
10. If evals regress, prefer reverting prompt text over weakening fixture expectations unless the fixture expectation is proven wrong.

Rollback strategy: each step is independently revertable; revert the offending slice and keep this OpenSpec as the reviewed contract for a smaller follow-up.

## Resolved Questions

- **Confidence band**: `confidenceBasis.band` is retired in the same schema revision that removes numeric `confidence`. Its one remaining job under this contract (downgrade-only veto) is better expressed as a typed unresolved risk, so the veto always carries a reason that the review queue can sort and moderators can act on; an opaque band gives reviewers nothing to triage with. `current_assignment` reaffirmation is evidence, not confidence, and moves to positive evidence where the derived tier consumes it. Until that revision lands, the band is downgrade-only.
- **Local-only identification**: stays a separate future capability, per the existing single-contract decision. Its product surfaces (photo tasting entry, Add Bottle fast path) are latency-sensitive and match-only, and its worst failure is attributing a user's tasting to the wrong bottle, so its contract will differ enough to deserve its own spec when the implementation is scheduled.
- **Prompt examples**: hand-authored in `instructions.ts`, never generated from eval fixtures. Fixtures are the measurement; reusing their concrete bottles in the prompt is training on the test set, and a fixture edit would silently change the production prompt. Any example must be disjoint from eval fixture bottles. If examples are added, prioritize create-naming cases, because proposed bottle names are the most user-visible artifact the classifier produces.
- **SMWS placement**: stays pre-agent. SMWS exact-cask codes are a closed identifier scheme, the same class as the exact-alias fast path, so resolving them before the agent is cheaper, faster, and zero-variance for a bottle family that core users add constantly. Post-agent SMWS handling remains only as presentation normalization for agent-path outputs, with one shared parsing module so the two paths cannot drift.
- **Candidate list size**: an eval experiment, not a spec rule (tasks). Adopt roughly ten ranked candidates with family siblings adjacent only if match slices hold parity and new-bottle slices show no recall regression. A dropped correct candidate produces a false `no_match`, which is the worst Add Bottle outcome: the user gets dumped to manual search.
