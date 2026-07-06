# Output Contract Map (tasks.md 1.6)

Audit of `BottleClassifierAgentDecisionSchema` against the target contract in
`specs/bottle-classifier-agent/spec.md` and `design.md`. Read-only; no source
files were modified.

Primary sources:

- Agent schema: `packages/bottle-classifier/src/classifierTypes.ts:638-678`
- Nested basis/observation schemas: `classifierTypes.ts:398-495`
- Prompt "Confidence:" section: `packages/bottle-classifier/src/instructions.ts:753-765`
- Prompt "Output:" section: `instructions.ts:767-788`
- Prompt aliasScope rules: `instructions.ts:714-716`
- Consumer finalize pipeline: `packages/bottle-classifier/src/reviewPolicy.ts:3867-3959`

Contract anchors:

- "Output basis fields explain the decision" — `spec.md:141-158`
- "Automation gating is derived by code from evidence" — `spec.md:160-182`
- "Basis fields evolve toward machine-checkable structure" — `spec.md:184-201`
- "Remove numeric confidence" — `design.md:117-131`
- "Output schema orders evidence before the action" — `design.md:133-135`
- "Schema attributes may be redesigned toward verifiability" — `design.md:137-147`

---

## 1. Field map

`BottleClassifierAgentDecisionSchema` has **14 top-level fields**
(`classifierTypes.ts:638-678`). "Prompt" = explained in `instructions.ts` prose;
"describe()" = has an inline Zod `.describe()` on the agent-schema field itself
(nested-object describes are noted separately).

| #   | Field                | Current type / default (`classifierTypes.ts`)                                                                                                             | Where explained                                                                                                                    | Spec verdict                          | Migration notes                                                                                                                                                                                                              |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `action`             | `enum(match, create_bottle, create_release, create_bottle_and_release, repair_parent_and_create_release, repair_bottle, no_match)`, required (`:639-660`) | Prompt Output bullets `instructions.ts:769-775`; **and** long `.describe()` `:649-660`                                             | **KEEP**                              | Enum stays; compound actions kept explicit (`design.md:145`). Only reordered — must move after basis fields.                                                                                                                 |
| 2   | `confidence`         | `z.number().min(0).max(100)`, required (`:661`)                                                                                                           | **Neither** — no prompt bullet, no `.describe()`. Only a code-comment ban on tuning `instructions.ts:662`                          | **REMOVE**                            | `design.md:117-131`, `spec.md:160-182`. Staged: emit-but-ignore, then delete from schema + scorers + fixtures. High consumer blast radius (see §3).                                                                          |
| 3   | `rationale`          | `z.string().nullable().default(null)` (`:662`)                                                                                                            | Prompt references it as a place to "mention" things (`instructions.ts:758,778,781`) but never as a field to fill; no `.describe()` | **KEEP (retype/relocate)**            | `spec.md:143` says basis fields explain the decision "without relying on freeform rationale." Rationale survives but is demoted; must be ordered before `action` with the basis fields (`spec.md:156-158`).                  |
| 4   | `candidateBottleIds` | `z.array(z.number().int()).default([])` (`:663`)                                                                                                          | **Neither** — no prompt mention, no `.describe()`                                                                                  | **KEEP (needs semantics or removal)** | Falls under `spec.md:84-86` (every serialized field must have semantics or be removed). Add prompt/describe semantics or drop.                                                                                               |
| 5   | `identityScope`      | `BottleIdentityScopeEnum.nullable().default(null)` (`:664`)                                                                                               | Prompt `instructions.ts:748-750`; **no** `.describe()` on the agent field (the base-union copy at `:501-503` has one)              | **KEEP**                              | Agent field lost the describe that the validated-union field has — describe should be reunified.                                                                                                                             |
| 6   | `aliasScope`         | `AliasScopeEnum.nullable().default(null)` (`:665`)                                                                                                        | Prompt `instructions.ts:714-716`; **no** `.describe()` on agent field (base-union copy `:504-506` has one)                         | **KEEP**                              | Alias safety is separate from identity scope (`spec.md:122-139`). Note the `Omit`+re-add TS gymnastics `classifierTypes.ts:724-736`.                                                                                         |
| 7   | `observation`        | `BottleObservationSchema.nullable().default(null)` (`:666`)                                                                                               | Prompt `instructions.ts:779`; nested fields have no describes (`:398-408`)                                                         | **KEEP**                              | Already typed (selector/caskNumber/barrelNumber/bottleNumber/outturn/market/exclusive). Good verifiability model to imitate.                                                                                                 |
| 8   | `identityBasis`      | `BottleIdentityBasisSchema.nullable().default(null)` (`:667`)                                                                                             | Prompt `instructions.ts:776-778`; nested fields have describes (`:415-449`)                                                        | **KEEP + RETYPE**                     | `spec.md:184-197`, `design.md:143`: move `bottleTraits`/`releaseTraits`/`observationTraits` from `array(string)` to typed trait fields aligned with `BOTTLE_RELEASE_TRAIT_FIELDS` (`:78-86`). See §4. Must be ordered first. |
| 9   | `confidenceBasis`    | `BottleConfidenceBasisSchema.nullable().default(null)` (`:668`)                                                                                           | Prompt "Confidence:" `instructions.ts:753-764`; nested describes `:453-495`                                                        | **KEEP + RETYPE, drop `band`**        | `band` removed with numeric confidence (`design.md:125,188`). `unresolvedRisks`/`positiveEvidence` become typed (`spec.md:151-153,189-193`). See §4.                                                                         |
| 10  | `matchedBottleId`    | `z.number().int().nullable().default(null)` (`:669`)                                                                                                      | Prompt Output `:769`; no `.describe()`                                                                                             | **KEEP**                              | Target id; ordered after basis.                                                                                                                                                                                              |
| 11  | `matchedReleaseId`   | `z.number().int().nullable().default(null)` (`:670`)                                                                                                      | Prompt Output `:769`; no `.describe()`                                                                                             | **KEEP**                              | Target id.                                                                                                                                                                                                                   |
| 12  | `parentBottleId`     | `z.number().int().nullable().default(null)` (`:671`)                                                                                                      | Prompt Output `:772,774,778`; no `.describe()`                                                                                     | **KEEP**                              | Target id.                                                                                                                                                                                                                   |
| 13  | `proposedBottle`     | `AgentProposedBottleSchema.nullable().default(null)` + `.describe()` (`:672-676`)                                                                         | Prompt Output `:780-786`; **has** `.describe()`                                                                                    | **KEEP**                              | Draft; ordered last. `AgentProposedBottleSchema` loosens `abv` to nullable (`:630-632`).                                                                                                                                     |
| 14  | `proposedRelease`    | `AgentProposedReleaseSchema.nullable().default(null)` (`:677`)                                                                                            | Prompt Output `:781`; no `.describe()`                                                                                             | **KEEP**                              | Draft; ordered last.                                                                                                                                                                                                         |

### Nested `confidenceBasis` fields (`classifierTypes.ts:453-495`)

| Nested field       | Type / default                                                                                       | Spec verdict                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `band`             | `enum(low, review, auto_verification, current_assignment)` default `review`, has describe `:456-460` | **REMOVE** (`design.md:125,188`; `spec.md:180-182`). `current_assignment` reaffirmation moves to `positiveEvidence`. |
| `positiveEvidence` | `array(string.min(1))` default `[]`, describe `:461-466`                                             | **RETYPE** to `{kind, locator, claim}` (`spec.md:189-191`).                                                          |
| `unresolvedRisks`  | `array(string.min(1))` default `[]`, describe `:467-472`                                             | **RETYPE** to `{category, note}` (`spec.md:153,187-188`; `design.md:125,140`).                                       |
| `toolsUsed`        | `enum[]` default `[]`, describe `:473-487`                                                           | **KEEP** (already typed enum).                                                                                       |
| `webEvidence`      | `enum(not_needed, not_used, supportive, weak, conflicting)` default `not_used`, describe `:488-493`  | **KEEP** (consumed by derived tier; `design.md:124`).                                                                |

---

## 2. Field-order plan

**Current agent-schema order** (`classifierTypes.ts:638-678`):

```
1 action        2 confidence    3 rationale     4 candidateBottleIds
5 identityScope 6 aliasScope    7 observation   8 identityBasis
9 confidenceBasis  10 matchedBottleId  11 matchedReleaseId
12 parentBottleId  13 proposedBottle  14 proposedRelease
```

The action is emitted **first** and evidence (`identityBasis`/`confidenceBasis`)
is emitted at positions 8-9 — i.e. the model commits to the decision before the
evidence. Structured output is generated in field order, so this violates
`spec.md:156-158` and `design.md:133-135` ("evidence before the action").

**Proposed order** — evidence → rationale → action → scope/observation → ids → drafts:

```
1  identityBasis        (evidence: trait placement)
2  confidenceBasis      (evidence: positiveEvidence, unresolvedRisks, webEvidence, toolsUsed)
3  rationale            (freeform, demoted, before action)
4  action               (the committed decision)
5  identityScope
6  aliasScope
7  observation
8  candidateBottleIds
9  matchedBottleId
10 matchedReleaseId
11 parentBottleId
12 proposedBottle
13 proposedRelease
```

`confidence` (old #2) is deleted. Notes:

- Basis (1-2) and rationale (3) precede `action` (4), satisfying "assert
  evidence before committing" (`spec.md:156-158`).
- `identityScope`/`aliasScope`/`observation` are decision qualifiers; kept
  adjacent to `action` and before ids.
- Ids (9-11) then drafts (12-13) last, matching the "ids, drafts" tail in the
  task's required order.
- This reorder is eval-visible (`design.md:135`, `spec.md:198-201`): land with
  re-recorded replays and before/after comparison.

---

## 3. Confidence consumer inventory

Numeric `confidence` and `confidenceBasis.band` feed the derived-tier
migration. Split into **decision-affecting** (must migrate to derived tier) and
**telemetry-only** (persist as historical columns per `design.md:168`).

### 3a. Numeric `confidence` — decision-affecting

| #   | File:line                                                                                 | What it decides                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/bottle-classifier/src/priceMatchingEvidence.ts:38-40`                           | Threshold constants: reaffirmed=80, unmatched=96, exact_cask=95.                                                                |
| 2   | `priceMatchingEvidence.ts:90-137` `isExistingMatchConfidenceEligibleForVerification`      | Gates whether an existing match is eligible for downstream auto-verification by comparing `confidence` to the three thresholds. |
| 3   | `apps/server/src/lib/priceMatchingAutomation.ts:1203-1214`                                | `modelConfidence === null` → not eligible; else calls #2 with `modelConfidence`. Store-price auto-verify gate.                  |
| 4   | `packages/bottle-classifier/src/reviewPolicy.ts:2609` (`capUnverifiedCreationAutomation`) | Caps `confidence` to 94 while demoting band.                                                                                    |
| 5   | `reviewPolicy.ts:2634` (`capAutoVerificationWithUnresolvedRisks`)                         | Caps `confidence` to 94 when risks present.                                                                                     |
| 6   | `reviewPolicy.ts:2658,2671` (`capIneligibleExistingMatchAutoVerification`)                | Passes `decision.confidence` into #2 and caps to 94 when ineligible.                                                            |
| 7   | `reviewPolicy.ts:2887-2888`                                                               | `normalizeClassifierConfidence(decision.confidence)` for downstream comparison.                                                 |
| 8   | `packages/bottle-classifier/src/classifierRuntime.ts:198`                                 | Local-identification no_match forces `Math.min(decision.confidence, 70)`.                                                       |
| 9   | `apps/server/src/orpc/routes/tastings/photo-identification.ts:68`                         | `confidence >= PHOTO_IDENTIFICATION_CREATE_CONFIDENCE_THRESHOLD` gate for auto-create.                                          |
| 10  | `photo-identification.ts:83`                                                              | `confidence >= 70` → suggest `confirm_match` vs `manual_search`.                                                                |
| 11  | `apps/server/src/lib/priceMatchingProposals.ts:234-236,304`                               | `normalizeClassifierConfidence` normalization applied to stored/derived confidence.                                             |
| 12  | `priceMatchingProposals.ts:2079-2081`                                                     | Feeds `modelConfidence: decision.confidence` into `getStorePriceMatchAutomationAssessment` (→ #3).                              |
| 13  | `apps/server/src/lib/bottleReferenceResolution.ts:411-412`                                | `normalizeIncomingBottleDecisionConfidence(decision.confidence)` for incoming-bottle resolution.                                |

### 3b. `confidenceBasis.band` — decision-affecting

| #   | File:line                       | What it decides                                                               |
| --- | ------------------------------- | ----------------------------------------------------------------------------- | --- | ------------------------------------------------------- |
| 14  | `reviewPolicy.ts:2603`          | `band !== "auto_verification"` short-circuits creation-automation cap.        |
| 15  | `reviewPolicy.ts:2626`          | `band !== "auto_verification"` (with unresolvedRisks) short-circuits.         |
| 16  | `reviewPolicy.ts:2656`          | `band !== "auto_verification"` short-circuits existing-match eligibility cap. |
| 17  | `photo-identification.ts:65-71` | `band === undefined                                                           |     | band === "auto_verification"` half of auto-create gate. |
| 18  | `classifierRuntime.ts:238`      | Local-match normalization propagates `band ?? "review"`.                      |

### 3c. `band` producers (set the value the consumers read)

| File:line                                                | Note                                                    |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `apps/server/src/agents/bottleClassifier/service.ts:271` | Exact-alias fast path sets `band: "auto_verification"`. |
| `packages/bottle-classifier/src/smwsPolicy.ts:485`       | SMWS exact-cask sets `band: "auto_verification"`.       |
| `classifierRuntime.ts:210,238`                           | Local-identification paths set/propagate band.          |

These deterministic anchors currently express certainty via `band`; under the
new contract they express it via `positiveEvidence` + empty `unresolvedRisks`
and let the derived tier decide (`design.md:188` — `current_assignment` becomes
positive evidence).

### 3d. Telemetry-only `confidence` / `band` writes (persist as history, not gates)

- `priceMatchingProposals.ts:570,610,627,653,670,687,706,725,821,862,1616,2492`
  (proposal rows, `modelConfidence` telemetry).
- `apps/server/src/orpc/routes/prices/matchQueue/utils.ts:97,324,336,356`
  (`modelConfidence` on queue rows).
- `apps/server/src/orpc/routes/admin/incoming-bottle-decisions.ts:171`
  (`confidence: row.log.confidence`).
- `photo-identification.ts:253,306-316` (Sentry attrs incl.
  `confidence_basis_band`), `photo-identification.ts:360-361` (per-field
  confidence, distinct source).
- `apps/server/src/worker/jobs/createMissingBottles.ts:131`,
  `apps/server/src/orpc/routes/reviews/create.ts:188` (stored `confidence`).

### 3e. Eval-fixture / scorer coupling

- `packages/bottle-classifier/src/evalFixtureSchemas.ts:137-139`
  `confidenceBand` expected field on fixtures (mirrors the removed enum) — must
  be retired with the schema change (`spec.md:198-201`).

**Decision-affecting count: 18** (13 numeric-confidence sites + 5 band sites),
across `priceMatchingEvidence.ts`, `priceMatchingAutomation.ts`,
`reviewPolicy.ts`, `classifierRuntime.ts`, `photo-identification.ts`,
`priceMatchingProposals.ts`, `bottleReferenceResolution.ts`.

---

## 4. Typed-basis sketch (proposals only — not applied to source)

Draft Zod shapes for the verifiability evolution in `design.md:137-147`,
`spec.md:184-197`. Reuse the existing `BOTTLE_RELEASE_TRAIT_FIELDS` vocabulary
(`classifierTypes.ts:78-86`).

### 4a. Risk-category enum (derived from observed risk strings)

Observed `unresolvedRisks` strings in tests + the "material risk" prose in
`instructions.ts:756-763`:

- `"new vintage release needs review"` (classifier.test.ts) → release/vintage ambiguity
- `"A broader sibling omits the age statement."` → sibling ambiguity
- `"same-family aged bottle siblings exist"` → sibling ambiguity
- fixture summaries: `"conflicts on age"`, `"conflicting statedAge 18"`,
  `"missing the observed 50% ABV"`, `"ambiguous for a confident canonical split"`
  (`src/eval-fixtures/**`) → trait conflict / insufficient evidence / identity ambiguity
- `spec.md:118-120` web-conflict scenario → web-evidence conflict
- `spec.md:174-177` requires an uncategorizable holistic veto category

Proposed enum:

```ts
export const UNRESOLVED_RISK_CATEGORIES = [
  "trait_conflict", // material trait (age, ABV, year, cask) conflicts across source/candidate/web
  "sibling_ambiguity", // nearby sibling bottles/releases make bottle-vs-release or target choice unclear
  "release_ambiguity", // new/unmodeled release, batch, or vintage that needs review
  "web_evidence_conflict", // web/source evidence conflicts with observed input or selected target
  "insufficient_evidence", // identity under-supported / title too generic to act safely
  "identity_ambiguity", // no safe canonical split; matching/creating would invent a hybrid
  "other", // holistic "something feels off"; the uncategorizable veto (spec.md:174-177)
] as const;

const UnresolvedRiskEntrySchema = z
  .object({
    category: z.enum(UNRESOLVED_RISK_CATEGORIES),
    note: z.string().trim().min(1), // freeform reason the review queue can sort/triage on
  })
  .strict();
```

### 4b. Typed `positiveEvidence` entries

```ts
export const POSITIVE_EVIDENCE_KINDS = [
  "source_label", // observed submitted title / label text
  "image", // image evidence
  "local_candidate", // an existing Peated candidate row
  "web_result", // agent-reviewed web/source page
  "exact_alias", // exact accepted local alias
  "exact_cask_code", // closed-form deterministic anchor (e.g. SMWS)
  "current_assignment", // reaffirms the current bottle/release assignment (design.md:188)
] as const;

const PositiveEvidenceEntrySchema = z
  .object({
    kind: z.enum(POSITIVE_EVIDENCE_KINDS),
    // locator lets validation confirm the citation exists in run artifacts
    // (candidate id, web result URL, image ref) and reject fabricated support:
    locator: z.string().trim().min(1).nullable().default(null),
    claim: z.string().trim().min(1), // what this evidence establishes
  })
  .strict();
```

Validation target (`spec.md:189-191`): for `kind = web_result`, `locator` must
be a URL present in the run's collected `BottleSearchEvidence`; for
`local_candidate`, `locator` must resolve to a candidate `bottleId`/`releaseId`.

### 4c. Typed `identityBasis` trait placement

Replace the three `array(string)` trait lists with typed trait entries keyed on
`BOTTLE_RELEASE_TRAIT_FIELDS`, so bottle-vs-release placement is mechanically
checkable (`spec.md:194-197`, `design.md:143`):

```ts
const IdentityTraitEntrySchema = z
  .object({
    field: BottleReleaseTraitFieldEnum, // "edition" | "statedAge" | "releaseYear" |
    // "vintageYear" | "abv" | "singleCask" | "caskStrength"
    value: z.string().trim().min(1), // observed value (string-encoded for schema uniformity)
  })
  .strict();

export const BottleIdentityBasisSchema = z
  .object({
    // stable parent identity traits
    bottleTraits: z.array(IdentityTraitEntrySchema).default([]),
    // reusable child-release identity traits
    releaseTraits: z.array(IdentityTraitEntrySchema).default([]),
    // exact source-only facts kept as observations (free-form remains acceptable
    // here since observation.* already carries the typed structured copy)
    observationTraits: z.array(z.string().trim().min(1)).default([]),
    yearInterpretation: z
      .enum([
        "none",
        "vintage_year",
        "release_year",
        "both",
        "ambiguous",
        "not_identity",
      ])
      .default("none"),
    siblingEvidence: z
      .enum([
        "none",
        "single_known_release",
        "existing_child_releases",
        "dirty_sibling_candidates",
        "unclear",
      ])
      .default("none"),
    uncertainties: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
```

Enables an eval/review check: a trait present in `releaseTraits` must not also
appear in `proposedBottle.name`, and vice-versa (the common-label goal in
`design.md:149-153`). `BOTTLE_RELEASE_TRAIT_FIELDS` already aligns with the
candidate `traitFields` vocabulary (`classifierTypes.ts:94,121,147`), so
placement is comparable to sibling candidate traits.

Note: `siblingEvidence` still contains the prompt-only jargon
`dirty_sibling_candidates` (`classifierTypes.ts:446`); the terminology-consistency
requirement (`spec.md:88-91`, `design.md:99`) applies here too.

---

## 5. Gaps (prompt guidance vs schema describe contradictions)

1. **Numeric `confidence` is undefined everywhere yet is a required field.**
   `confidence: z.number().min(0).max(100)` (`classifierTypes.ts:661`) has no
   `.describe()` and no prompt bullet. The only mention is a code comment
   telling maintainers _not_ to tune it: `instructions.ts:662` ("...confidence
   tuning here. Add durable policy..."). The model must emit a required 0-100
   number with zero guidance. This is the strongest argument for removal
   (`design.md:117-131`) and a concrete "field with no explanation."

2. **`band` describe says "imply from evidence" but the prompt forbids the one
   upgrade and the server only downgrades it.** Schema describe
   (`classifierTypes.ts:456-460`) frames `auto_verification` as the model's call
   when evidence is strong and risks empty. But `instructions.ts:761` bars
   `auto_verification` whenever any `unresolvedRisks` exist, and
   `reviewPolicy.ts:2603-2680` unconditionally caps `auto_verification` back to
   `review` in three code paths. So the describe implies model authority the
   contract denies — exactly the "second confidence channel" the design removes
   (`design.md:119,125`).

3. **`identityScope` / `aliasScope` describes exist on the validated-union base
   schema but are missing on the agent schema the model actually sees.**
   `BottleClassifierDecisionBaseSchema` carries describes
   (`classifierTypes.ts:501-506`), but `BottleClassifierAgentDecisionSchema`
   redeclares both as bare `.nullable().default(null)`
   (`classifierTypes.ts:664-665`). The model-facing schema is less documented
   than the internal one; the prompt (`instructions.ts:714-716,748-750`) is the
   only guidance. Not a contradiction in wording, but a describe-coverage gap on
   the surface that matters.

4. **`unresolvedRisks` describe defines it broadly ("missing traits ...weak
   evidence") while the prompt enumerates several exceptions that narrow it.**
   Describe (`classifierTypes.ts:467-472`) says missing traits and weak evidence
   are risks; the prompt then excludes missing optional ABV, source-absent
   stored metadata, equivalent finish/variant wording, and hypothetical future
   siblings (`instructions.ts:756-760`). The prose is the real contract; the
   describe over-includes. The typed `{category, note}` migration (§4a) plus
   moving the "material" test into structure is the resolution.

5. **`rationale` is nullable/optional in schema with no describe, but the prompt
   treats it as the place to record identity reasoning** ("mention them in the
   rationale," "unless the rationale explains why," "must match the rationale":
   `instructions.ts:758,778,781`). The schema signals rationale is disposable;
   the prompt leans on it for decisions. The contract wants that reasoning in
   structured basis fields instead (`spec.md:143`), so this tension is expected
   to resolve by demotion, not by strengthening rationale.

---

## Summary (10 lines)

1. `BottleClassifierAgentDecisionSchema` has 14 top-level fields (`classifierTypes.ts:638-678`).
2. Spec verdict: KEEP 11, REMOVE 1 (`confidence`), plus nested `confidenceBasis.band` removed; RETYPE `identityBasis` + `confidenceBasis.positiveEvidence`/`unresolvedRisks`.
3. Fields with NO explanation (neither prompt nor `.describe()`): `confidence` and `candidateBottleIds` (2).
4. `identityScope`/`aliasScope` are prompt-only on the agent schema (their `.describe()` lives only on the internal validated-union base).
5. Current order emits `action` first, basis at #8-9 — violates evidence-before-action; proposed order leads with `identityBasis`, `confidenceBasis`, `rationale`, then `action`, ids, drafts.
6. Decision-affecting confidence consumers: 18 (13 numeric-`confidence` + 5 `confidenceBasis.band`) across 7 files.
7. Plus deterministic band producers (service.ts:271, smwsPolicy.ts:485, classifierRuntime) and telemetry-only writes that stay as history.
8. Proposed risk categories: `trait_conflict`, `sibling_ambiguity`, `release_ambiguity`, `web_evidence_conflict`, `insufficient_evidence`, `identity_ambiguity`, `other`.
9. Typed sketches drafted for `{category,note}` risks, `{kind,locator,claim}` evidence, and `identityBasis` trait entries keyed on `BOTTLE_RELEASE_TRAIT_FIELDS`.
10. Five gaps documented; the sharpest is required-but-undocumented numeric `confidence` and the `band` describe claiming model authority the prompt+reviewPolicy revoke.
