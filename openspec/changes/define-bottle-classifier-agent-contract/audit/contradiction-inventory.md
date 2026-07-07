# Bottle Classifier Prompt — Contradiction / Override Inventory

Scope: `packages/bottle-classifier/src/instructions.ts`
`BOTTLE_CLASSIFIER_INSTRUCTIONS` (lines 664–789) and
`BOTTLE_LOCAL_IDENTIFIER_INSTRUCTIONS` (lines 800–830), plus
`BOTTLE_SCHEMA_RULES` from `packages/bottle-classifier/src/bottleSchemaGuidance.ts`
interpolated into the classifier prompt at lines 687–691.

Tasks covered: `tasks.md` 1.2 (missing/duplicated/stale/contradictory guidance)
and 1.3 (contradiction/override inventory).

All quotes cite `file:line`. Bullet arrays are rendered by `renderBulletLines`, so
each numbered rule below maps to exactly one source line.

---

## 1. Numbered rule inventory

### 1a. `BOTTLE_CLASSIFIER_INSTRUCTIONS` (instructions.ts:664–789)

Task header (not counted as rules):

- `instructions.ts:665` — "Task: classify one whisky reference against existing bottle/release (bottling) candidates."
- `instructions.ts:666` — "Return only the structured decision."

**Section DC — Decision Contract** (`instructions.ts:668`, bullets 670–682)

- DC-1 `:670` — "Prefer `no_match` over a false positive match or unsupported create."
- DC-2 `:671` — "Resolve source identity before catalog outcome: identify the bottle family plus exact release/bottling details, then decide whether that exact target already exists or needs creation."
- DC-3 `:672` — "Use local Peated candidates like prior-art evidence: they show existing targets and modeling patterns, but they must not collapse a clear source bottling into a broader or wrong nearby row."
- DC-4 `:673` — "If an existing local bottle or release already covers the exact observed bottle/release identity, choose `match` for that target instead of creating a duplicate cleaner-modeled child release. Catalog remodeling can happen later; the classifier outcome should answer whether the observed target already exists."
- DC-5 `:674` — "Do not choose `create_release` solely to remodel an existing exact bottle candidate under a cleaner parent. If the exact candidate has the same concrete edition, batch, ABV, or other bottling marker and no conflicting canonical traits, return `match` for that existing target."
- DC-6 `:675` — "`no_match` means the bottle/release identity is unresolved or creation would invent an ambiguous hybrid. Do not use `no_match` merely because a clear identity has catalog enrichment or repair follow-up."
- DC-7 `:676` — "Use local candidates first; use web search for disputed, missing, or create-critical traits. When a finish, expression, or variant separates close candidates, search contrastively for the source wording and the plainer candidate identity. Prefer broad unquoted product-word queries over exact quoted retailer titles."
- DC-8 `:677` — "Creation requires supportive web evidence and a local candidate check that covers decisive traits; rerun local search when web evidence reveals a decisive trait not already covered by provided candidates."
- DC-9 `:678` — "Decide bottle-vs-bottling scope before trusting exact-name candidates. Exact local rows are unsafe when they appear to be legacy bottling rows under a stable family."
- DC-10 `:679` — "Match when an existing bottle or release/bottling covers the marketed identity without conflicting canonical traits. Before matching an exact bottle row, check whether bottling-level traits in that row should instead be a child release under a stable family."
- DC-11 `:680` — "Repair only when the current/local target identity is right but stored canonical fields make that target identity unsafe. Missing optional facts or cleanup opportunities are downstream enrichment; do not let them block match/create."
- DC-12 `:681` — "Create the narrowest supported target: bottle, bottling under an existing clean parent, or bottle plus bottling."
- DC-13 `:682` — "If evidence maps the source wording to a different canonical product, use that evidenced identity or return `no_match`; do not create a hybrid."

**Section ST — Schema Terms** (`instructions.ts:685`, bullets 687–697)

- ST-1 `:687` — `BOTTLE_SCHEMA_RULES.bottleIdentity` (`bottleSchemaGuidance.ts:2-3`): "Bottle identity is the stable parent product and the default object for tasting, search, and collection... once sibling evidence exists, those varying traits belong on child releases."
- ST-2 `:688` — `BOTTLE_SCHEMA_RULES.releaseIdentity` (`bottleSchemaGuidance.ts:4-5`): "Release identity is optional and only exists under a bottle when the differentiator should aggregate across users, searches, prices, and stats..."
- ST-3 `:689` — `BOTTLE_SCHEMA_RULES.yearPolicy` (`bottleSchemaGuidance.ts:6-7`): "Year fields are not interchangeable. `vintageYear` is a distillation year; `releaseYear` is a bottling or marketed release year..."
- ST-4 `:690` — `BOTTLE_SCHEMA_RULES.observationPolicy` (`bottleSchemaGuidance.ts:8-9`): "Exact source facts like cask numbers, bottle numbers, outturns, exclusives, and raw maturation wording should be preserved as observations first..."
- ST-5 `:691` — `BOTTLE_SCHEMA_RULES.aliasPolicy` (`bottleSchemaGuidance.ts:10-11`): "Retailer listing aliases are bottle-level evidence unless they exactly match a canonical release alias."
- ST-6 `:692` — "`brand`: consumer-facing label brand."
- ST-7 `:693` — "`bottler`: separately stated bottler only."
- ST-8 `:694` — "`distillery`: producing distillery or distilleries."
- ST-9 `:695` — "`expression`: core bottle name after producer, age, ABV, and generic style words."
- ST-10 `:696` — "`series`: stable range. `edition`: batch, store-pick code, release code, numbered variant."
- ST-11 `:697` — "`category`: house value or `null`; do not force fallback buckets."

**Section EC — Evidence And Candidates** (`instructions.ts:700`, bullets 702–709)

- EC-1 `:702-704` — "Compare components in this order: " + `MATCH_COMPONENT_PRIORITY` + "." (priority list defined `instructions.ts:140-153`).
- EC-2 `:705` — "Candidates can be bottle or release/bottling targets. Use `kind` and `releaseId`."
- EC-3 `:706` — "`familyContext` is evidence about sibling bottles and child bottlings; it is not a deterministic rule."
- EC-4 `:707` — "Use structured fields first, then names/aliases when structured data is sparse."
- EC-5 `:708` — "Ignore generic words, package text, condition text, retailer SEO, volume, and gift packaging."
- EC-6 `:709` — "Judge web results by specificity, independence, and corroboration, not domain familiarity alone."

**Section AS — Source And Alias Scope** (`instructions.ts:712`, bullets 714–717)

- AS-1 `:714` — "Always fill `aliasScope`."
- AS-2 `:715` — "`aliasScope = global_alias` only when the listing title itself is safe as a reusable bottle alias."
- AS-3 `:716` — "`aliasScope = none` when no reusable global alias should be created; use it for generic, underspecified, source-specific, or otherwise unsafe listing titles."
- AS-4 `:717` — "Do not infer alias safety from brand prefixes, retailer domain names, title shape, `single barrel` wording, search rank, or sibling family snippets. Use the reviewed evidence in this run."

**Section BC — Bottle, Bottling, Exact Cask** (`instructions.ts:720`, bullets 722–750)

- BC-1 `:722` — "A parent bottle is the stable marketed product family."
- BC-2 `:723` — "A release is the schema term for a reusable child bottling under a clean parent."
- BC-3 `:724` — "Choose the marketed container: reusable parent with child bottlings, or a standalone bottle identity."
- BC-4 `:725` — "Use a child release/bottling only when the source or candidates provide concrete reusable bottling identity: edition, batch, volume/chapter, release/bottling year, vintage/distillation year, ABV, cask-strength plus a concrete batch/pick/recipe/barrel marker, single-cask plus a concrete cask/pick marker, or a specific release under a named program."
- BC-5 `:726` — "If the source names only the parent family and omits the concrete batch/year/chapter/volume/bottling marker, match or create the parent bottle only; do not create an empty or minimal child release just because web evidence says releases exist, and do not abstain solely because the family also has batch-specific releases."
- BC-6 `:727` — "When a stable family name has a concrete bottling marker, keep the family on the bottle and the marker on the release/bottling instead of flattening both into one bottle name."
- BC-7 `:728` — "Chapter, volume, part, batch, and annual labels under the same named series are bottling markers when sibling rows vary only by that marker; exact chapter-specific bottle rows are legacy bottling rows, not safe parent matches."
- BC-8 `:729` — "Do not match an edition-specific candidate to a broader source that omits that edition marker; create or repair the clean parent when evidence supports the broader bottle."
- BC-9 `:730` — "When a year is attached to a stable family name, keep it as child bottling identity even if no parent exists yet; use release/bottling year unless source wording or stronger evidence says vintage/distillation year. Year-role ambiguity changes which release field you fill, not whether a web-supported family plus year can be created."
- BC-10 `:731` — "For bottling markers under a stable family: use `create_release` with a clean parent, `repair_parent_and_create_release` when the selected parent stores conflicting bottling traits, and `create_bottle_and_release` only when no existing candidate can serve as that parent."
- BC-11 `:732` — "When no local parent exists for a stable family plus bottling marker, use `create_bottle_and_release`; do not collapse the marker into `proposedBottle` just because there is no parent to attach to yet."
- BC-12 `:733` — "Local parent and sibling context can be enough to create a child release when the source provides the missing concrete marker. If a clean parent exists and sibling releases prove that marker type, create the release even when web evidence is unavailable. If only dirty sibling bottle rows exist and they share a clear reusable family, create the missing parent plus release rather than returning `no_match` solely because web evidence is unavailable."
- BC-13 `:734` — "`create_bottle_and_release` is for a missing family parent, not for a dirty same-family row; repair the dirty row when it can become the proposed parent by removing bottling traits."
- BC-14 `:735` — "Choose the parent by cleaned family identity, not by highest score alone: use a clean parent when present, otherwise use a dirty same-family row as the repair parent when removing release markers yields the proposed parent."
- BC-15 `:736` — "Exact local bottle rows can be dirty legacy bottlings. Exact-name match is not enough when the row carries bottling-specific traits that should be split under a stable parent."
- BC-16 `:737` — "However, when the source includes the same concrete bottling marker and the exact local bottle row has no conflicting canonical traits, treat that existing row as already covering the observed identity. Do not create a duplicate release solely to remodel a legacy bottle row under a clean parent."
- BC-17 `:738` — "This existing-target rule overrides clean-parent modeling: if matching the exact candidate avoids duplicate catalog creation, match it and leave parent/release cleanup to downstream catalog repair."
- BC-18 `:739` — "Age alone does not make a child bottling. When an exact age-stated bottle row exists and there is no batch, year, edition, existing child release, or authoritative recurring-bottling evidence for that family, match the age-stated bottle instead of inventing an age release under an age-less parent."
- BC-19 `:740` — "Cask-strength, barrel-proof, barrel-strength, full-proof, and single-barrel wording alone can be stable bottle identity; do not create a child bottling from strength wording unless the source also has a concrete batch, year, recipe, barrel, pick, ABV, or program marker."
- BC-20 `:741` — "If a barrel-strength single-barrel/private-selection style reference lacks the concrete recipe, pick, barrel, ABV, or selector needed to identify a bottling, use `no_match` rather than creating a generic standalone bottle."
- BC-21 `:742` — "Do not use `repair_parent_and_create_release` when a clean parent candidate already exists. Dirty sibling rows prove release modeling; they do not make the clean parent dirty."
- BC-22 `:743` — "Existing child releases/bottlings under a broad candidate prove bottling capacity, not parent suitability; the parent must cover the marketed family without omitting a decisive expression, finish, or variant."
- BC-23 `:744` — "Keep stable expression, finish, or variant wording on `proposedBottle` unless evidence makes it a reusable bottling marker under a plainer parent."
- BC-24 `:745` — "Do not add age, vintage, year, cask, or batch facts to `proposedBottle` just because web results mention them. Use web evidence to confirm the canonical product, but keep `proposedBottle` scoped to source-supported bottle identity; standalone exact-cask bottles and weak generic-parent avoidance are the narrow exceptions below."
- BC-25 `:746` — "Do not match a candidate whose name contains a cask/barrel code, bottle number, outturn, or selector that the source lacks when evidence also supports an uncoded product identity; absence of a cleaner local row means create the supported uncoded product, not match the narrower coded row."
- BC-26 `:747` — "Do not invent a generic parent solely to hold vintage, ABV, cask, or batch facts."
- BC-27 `:748` — "Use `identityScope = exact_cask` only when the exact cask itself is the marketed bottle identity."
- BC-28 `:749` — "Exact-cask requires source evidence that the product itself is the single cask, not only incidental cask wording."
- BC-29 `:750` — "Exact-cask identity does not create child releases/bottlings."

**Section CF — Confidence** (`instructions.ts:753`, bullets 755–764)

- CF-1 `:755` — "Fill `confidenceBasis` from the evidence used for the decision."
- CF-2 `:756` — "`auto_verification` requires concrete positive evidence and no unresolved material risk. Only list risks that could change the action or target; missing optional ABV, distillery, producer-controlled source evidence, minor equivalent name wording, or hypothetical future siblings are not material when they are not needed to distinguish the target."
- CF-3 `:757` — "For a readable uploaded label photo, label-visible exact barrel/cask, age, ABV, and edition details are primary source evidence. Lack of independent web corroboration for that exact private barrel or scene is not material when local candidates do not already cover the visible identity."
- CF-4 `:758` — "Do not put equivalent finish, variant, or expression wording differences in `confidenceBasis.unresolvedRisks` when evidence shows they refer to the same marketed identity; mention them in the rationale only if useful."
- CF-5 `:759` — "Do not put an existing candidate's source-absent year, ABV, or other optional stored metadata in `confidenceBasis.unresolvedRisks` when the candidate otherwise covers the source identity; that is catalog enrichment or cleanup, not an identity risk."
- CF-6 `:760` — "Do not put future catalog modeling ideas in `confidenceBasis.unresolvedRisks`, such as that the product may later become a parent with coded child releases, unless an existing candidate currently provides that parent/release target."
- CF-7 `:761` — "If you include any `confidenceBasis.unresolvedRisks`, do not use `confidenceBasis.band = auto_verification`."
- CF-8 `:762` — "Use `current_assignment` only when cleanly reaffirming the current bottle/release assignment."
- CF-9 `:763` — "Name the decisive evidence and material risks, especially candidate conflicts. Bottle-vs-bottling boundary uncertainty is material only when an existing plausible parent or release target could change the action; do not list speculative future modeling as an unresolved risk for a web-supported standalone product creation."
- CF-10 `:764` — "List only tools actually used in `confidenceBasis.toolsUsed`."

**Section OUT — Output** (`instructions.ts:767`, bullets 769–787)

- OUT-1 `:769` — "`match`: choose this when an existing bottle or release/bottling already safely covers the marketed identity. Return `matchedBottleId` and, for release matches, `matchedReleaseId`."
- OUT-2 `:770` — "`repair_bottle`: choose this when an existing bottle is the right identity but its stored canonical fields make that identity unsafe... Do not choose `repair_bottle` only to fill missing optional facts such as ABV..."
- OUT-3 `:771` — "`create_bottle`: choose this when the source supports a new standalone bottle and no reusable child bottling is needed. Return `proposedBottle` only."
- OUT-4 `:772` — "`create_release`: choose this when a clean existing parent bottle should receive a new child bottling. Return that clean parent as `parentBottleId`, not a dirty/exact child-like row, plus `proposedRelease`."
- OUT-5 `:773` — "`create_bottle_and_release`: choose this when the source supports both a missing stable parent bottle and a child bottling under it. Return both `proposedBottle` and `proposedRelease`."
- OUT-6 `:774` — "`repair_parent_and_create_release`: choose this only when no clean parent candidate exists and an existing candidate can become the family parent by removing bottling-specific traits. Return `parentBottleId`, repaired parent `proposedBottle`, and `proposedRelease`."
- OUT-7 `:775` — "`no_match`: choose this when there is no safe existing target and no supported create action, or when creating would invent an ambiguous hybrid."
- OUT-8 `:776` — "Always fill `identityBasis`: stable bottle facts in `bottleTraits`, child bottling facts in `releaseTraits`, and source-only facts in `observationTraits`."
- OUT-9 `:777` — "Use `identityBasis` to explain any bottle-vs-bottling or exact-cask boundary decision."
- OUT-10 `:778` — "Verify selected ids match the rationale: if you identify a clean parent, `parentBottleId` must be that clean parent, not the dirty sibling."
- OUT-11 `:779` — "Use `observation` for selector names, cask numbers, bottle numbers, outturn, market/exclusive wording, and exact facts that should not force canonical release split."
- OUT-12 `:780` — "For `proposedBottle.name`, use evidenced canonical name, not copied retailer title."
- OUT-13 `:781` — "For `proposedRelease`, carry over source-supported structured release fields from extraction, including `releaseYear`, unless the rationale explains why the extracted field is not identity."
- OUT-14 `:782` — "For standalone `create_bottle` decisions, include marketed differentiators such as age, vintage, release year, finish, cask code, batch, or cask-strength wording in `proposedBottle.name` when omitting them would create a weak generic parent. Keep ABV in the structured `abv` field, not in `proposedBottle.name`."
- OUT-15 `:783` — "For standalone `create_bottle` with `identityScope = exact_cask`, put source-stated age, ABV, vintage year, cask-strength, and single-cask flags on `proposedBottle`... include source-marketed age and vintage year in `proposedBottle.name`... Keep ABV in the structured `abv` field..."
- OUT-16 `:784` — "For standalone `create_bottle`, do not fill `proposedBottle.statedAge` from web-only evidence when the extracted source identity has no age and no local candidate conflict requires the age."
- OUT-17 `:785` — "For `create_bottle`, keep all bottle-level identity traits on `proposedBottle`; if they are child bottling traits, use a release action instead."
- OUT-18 `:786` — "Return `{ id, name }` objects for `brand`, `distillers`, `bottler`, and `series`; use `id: null` when unknown."
- OUT-19 `:787` — "Never invent websites, relationships, release details, or proof numbers."

**Classifier prompt rule count: 92 bullets** (DC 13 + ST 11 + EC 6 + AS 4 + BC 29 + CF 10 + OUT 19), plus 2 task-header lines.

### 1b. `BOTTLE_LOCAL_IDENTIFIER_INSTRUCTIONS` (instructions.ts:800–830)

Task header: `:801-802`.

**LID-DC — Decision Contract** (`:804`, bullets 806–810)

- LID-DC-1 `:806` — "Return `match` only when an existing local bottle or release candidate safely covers the marketed identity."
- LID-DC-2 `:807` — "Return `no_match` when local evidence is missing, ambiguous, incomplete, or requires web/canonical classification."
- LID-DC-3 `:808` — "Do not create bottles, create releases, repair bottles, repair parents, or infer missing canonical identity."
- LID-DC-4 `:809` — "Do not use or request web evidence. This pass is local-only."
- LID-DC-5 `:810` — "Prefer `no_match` over a false positive local match."

**LID-EC — Evidence And Candidates** (`:813`, bullets 815–819)

- LID-EC-1 `:815` — "Use local candidates first."
- LID-EC-2 `:816` — "Use structured extracted fields first, then names/aliases when structured data is sparse."
- LID-EC-3 `:817` — "Candidates can be bottle or release targets. Use `kind` and `releaseId`."
- LID-EC-4 `:818` — "`familyContext` is evidence about sibling bottles and child releases; it is not a deterministic rule."
- LID-EC-5 `:819` — "Ignore generic words, package text, condition text, retailer SEO, volume, and gift packaging."

**LID-OUT — Output** (`:822`, bullets 824–828)

- LID-OUT-1 `:824` — "`match`: safe existing candidate id."
- LID-OUT-2 `:825` — "`no_match`: no safe local existing match. The caller may run full classification."
- LID-OUT-3 `:826` — "Always fill `identityBasis` and `confidenceBasis` from local evidence only."
- LID-OUT-4 `:827` — "Set `confidenceBasis.webEvidence = not_used` or `not_needed`; never use `supportive`."
- LID-OUT-5 `:828` — "List only local tools actually used in `confidenceBasis.toolsUsed`."

Local identifier rule count: 15 bullets. (Local identification is out of scope for
consolidation per design.md "Keep one full classifier agent contract"; it is
inventoried only to show cross-prompt duplication.)

---

## 2. Rule pairs that need precedence language to coexist

Each pair below can only sit side-by-side because one rule carries an explicit
precedence word ("overrides", "however", "unless", "solely", "do not ... just
because", "narrow exceptions below"). Per spec requirement **"Precedence lives in
the workflow order"** (spec.md:217-220), these must fold into ordered
decision-workflow steps so step order — not override prose — expresses the
precedence.

### Pair P1 — Exact-row match vs. legacy-bottling split (the explicit "overrides" chain)

- **Rule A** BC-15 `:736`: "Exact local bottle rows can be dirty legacy bottlings. Exact-name match is not enough when the row carries bottling-specific traits that should be split under a stable parent."
- **Rule B** BC-16 `:737`: "However, when the source includes the same concrete bottling marker and the exact local bottle row has no conflicting canonical traits, treat that existing row as already covering the observed identity..."
- **Rule C** BC-17 `:738`: "This existing-target rule overrides clean-parent modeling: if matching the exact candidate avoids duplicate catalog creation, match it and leave parent/release cleanup to downstream catalog repair."
- Also stated up front as DC-4 `:673` and DC-5 `:674`.
- **Behavior the patch rules own** (B + C): avoid a duplicate-creation false positive when the observed marker already exists on a legacy row — the "don't remodel an existing row into a new clean release" production guard. Maps to spec **"Existing parent covers bottle only"** and **"Existing release candidate matches exact identity"** (spec.md:93-101).
- **Workflow step order that removes the override**: Step order should be (1) resolve observed bottle+release traits; (2) _does a candidate already cover exactly those traits with no conflicting canonical trait?_ → `match`; (3) only if no such covering candidate exists, evaluate clean-parent-vs-legacy split for a create/repair. Put the "already-covered" test **before** the "split legacy rows" test; the earlier step wins by position and "overrides" / "however" disappear.

### Pair P2 — `create_release` remodeling vs. clean-parent preference

- **Rule A** DC-5 `:674`: "Do not choose `create_release` solely to remodel an existing exact bottle candidate under a cleaner parent."
- **Rule B** BC-10 `:731` / OUT-4 `:772`: create_release "when a clean existing parent bottle should receive a new child bottling."
- **Behavior A owns**: the "solely" guard blocks catalog-cleanup-motivated release creation when a direct match exists (false-positive create suppression). Same production case as P1.
- **Workflow order**: same match-first step as P1 gates before any create_release branch; remove "solely".

### Pair P3 — Exact-name candidate is unsafe vs. exact-name candidate is a match

- **Rule A** DC-9 `:678` / BC-15 `:736`: "Exact local rows are unsafe when they appear to be legacy bottling rows under a stable family" / "Exact-name match is not enough".
- **Rule B** DC-10 `:679`: "Match when an existing bottle or release/bottling covers the marketed identity without conflicting canonical traits. Before matching an exact bottle row, check whether bottling-level traits in that row should instead be a child release..."
- **Behavior B owns**: forces a bottle-vs-release scope check _before_ accepting an exact-name row, guarding against matching an over-specific legacy row (spec **"Local candidate is nearby but not exact"**, spec.md:12-16).
- **Workflow order**: one step "classify observed scope (bottle vs release vs exact-cask)" runs before the match step, so the scope decision precedes candidate trust without "not enough"/"unsafe" framing.

### Pair P4 — Age is stable bottle identity vs. release triggers

- **Rule A** BC-18 `:739`: "Age alone does not make a child bottling... match the age-stated bottle instead of inventing an age release under an age-less parent."
- **Rule B** BC-4 `:725`: child release "only when the source or candidates provide concrete reusable bottling identity: edition, batch, ... " (age not in the trigger list, but ST-1/ST-3 treat release-specific age as release identity).
- **Behavior A owns**: prevents spurious age-driven release splits — the "12yo is bottle identity, not a release variant" guard (spec **"Bottle-level age is stable identity"**, spec.md:59-62; whisky-identity-model Single Known Release Rule).
- **Workflow order**: fold into the release-trigger step as a positive enumerated condition ("release requires one of {edition, batch, year, vintage, ABV variant, cask marker, program}"); age absent from that closed list means bottle-level by construction, so the "alone does not" negation is unnecessary.

### Pair P5 — Cask-strength/single-barrel is bottle identity vs. is a release trigger

- **Rule A** BC-19 `:740`: "Cask-strength, barrel-proof, barrel-strength, full-proof, and single-barrel wording alone can be stable bottle identity; do not create a child bottling from strength wording unless the source also has a concrete batch, year, recipe, barrel, pick, ABV, or program marker."
- **Rule B** BC-4 `:725`: release trigger includes "cask-strength plus a concrete batch/pick/recipe/barrel marker, single-cask plus a concrete cask/pick marker".
- **Rule C** BC-20 `:741`: "If a barrel-strength single-barrel/private-selection style reference lacks the concrete recipe, pick, barrel, ABV, or selector... use `no_match` rather than creating a generic standalone bottle."
- **Behavior owned**: A guards against strength-word-driven release splits; C guards against creating a vague standalone parent from an under-specified single-barrel reference. Two different false outcomes (bad split vs. bad create) hang off the same "unless there is a concrete marker" condition.
- **Workflow order**: single "does a concrete reusable marker exist?" gate feeds the release-trigger step; strength/single-barrel words route to bottle-level when the gate is false, and to `no_match` when even bottle identity is under-specified. The "alone... unless" and "lacks... rather than" phrasings collapse into the gate's true/false branches.

### Pair P6 — Do not use `repair_parent_and_create_release` vs. use it

- **Rule A** BC-21 `:742`: "Do not use `repair_parent_and_create_release` when a clean parent candidate already exists. Dirty sibling rows prove release modeling; they do not make the clean parent dirty."
- **Rule B** BC-10 `:731` / BC-14 `:735` / OUT-6 `:774`: use `repair_parent_and_create_release` "when the selected parent stores conflicting bottling traits" / "otherwise use a dirty same-family row as the repair parent".
- **Behavior A owns**: prevents needless parent repair when a clean parent is already available — pick `create_release` on the clean parent instead (spec **"repair_parent_and_create_release"** correctness bar, bottle-classifier.md:67-69).
- **Workflow order**: ordered parent-selection step: "clean parent present → create_release; else dirty same-family row that cleans to the parent → repair_parent_and_create_release; else create_bottle_and_release." The precedence is the branch order (BC-10 already encodes this), so BC-21's standalone "do not" prohibition is redundant once the branch is ordered.

### Pair P7 — Keep facts off `proposedBottle` vs. include differentiators in `proposedBottle.name`

- **Rule A** BC-24 `:745`: "Do not add age, vintage, year, cask, or batch facts to `proposedBottle` just because web results mention them... standalone exact-cask bottles and weak generic-parent avoidance are the narrow exceptions below."
- **Rule B** OUT-14 `:782`: "For standalone `create_bottle` decisions, include marketed differentiators such as age, vintage, release year, finish, cask code, batch, or cask-strength wording in `proposedBottle.name` when omitting them would create a weak generic parent."
- **Rule C** OUT-15 `:783`: exact_cask standalone puts age/vintage/cask-strength on `proposedBottle`.
- **Rule D** BC-26 `:747`: "Do not invent a generic parent solely to hold vintage, ABV, cask, or batch facts."
- **Behavior owned**: A/D suppress dirty-parent creation from web-only detail (spec **"Observation trait is too exact"** / **"Release trait belongs below parent"**, spec.md:64-72); B/C carry the "weak generic parent" exception where those traits _are_ the marketed bottle identity (spec **"Single known marketed form"** spec.md:46-48, and identityScope=exact_cask).
- **Workflow / action-semantics order**: this belongs in the action-semantics step for `create_bottle`, expressed as one placement rule keyed on identity layer (bottle-level identity → name; release-level → release; exact-only → observation) with the exact_cask/single-known-form case as a defined identity layer, not a "narrow exception below" pointer.

### Pair P8 — Match the coded row vs. create the uncoded product

- **Rule A** DC-4 `:673`: match an existing row that covers the exact identity to avoid duplicate creation.
- **Rule B** BC-25 `:746`: "Do not match a candidate whose name contains a cask/barrel code, bottle number, outturn, or selector that the source lacks when evidence also supports an uncoded product identity; absence of a cleaner local row means create the supported uncoded product, not match the narrower coded row."
- **Behavior B owns**: prevents matching an over-specific coded row to an uncoded source (the inverse of P1 — over-specific-candidate false positive, spec **"Local candidate is nearby but not exact"** spec.md:12-16).
- **Workflow order**: the scope-classification step (from P3) establishes whether the observed identity is coded/exact-cask or uncoded; the match step then only accepts candidates at the same precision layer. Position removes the DC-4-vs-BC-25 tension.

### Pair P9 — Do not create empty release vs. create release when family has batches

- **Rule A** BC-5 `:726`: "do not create an empty or minimal child release just because web evidence says releases exist, and do not abstain solely because the family also has batch-specific releases."
- **Rule B** BC-4 `:725`: create a child release when a concrete reusable marker is present.
- **Behavior A owns**: two guards — no marker-less release, and no `no_match` merely because siblings exist (missed-match guard, spec **"Clear source identity missing from Peated"** spec.md:7-10).
- **Workflow order**: fold into the release-trigger gate (see P4/P5): marker present → release; marker absent → match/create parent only; existence of sibling batches never forces abstention. The "just because"/"solely" negations become the default false branches.

### Pair P10 — Confidence: `auto_verification` allowed vs. any risk forbids it

- **Rule A** CF-2 `:756`: "`auto_verification` requires concrete positive evidence and no unresolved material risk. Only list risks that could change the action..."
- **Rule B** CF-7 `:761`: "If you include any `confidenceBasis.unresolvedRisks`, do not use `confidenceBasis.band = auto_verification`."
- **Rules C** CF-4/CF-5/CF-6 `:758-760`: three "do not put X in unresolvedRisks" carve-outs that only exist to keep A/B from over-firing.
- **Behavior owned**: A/B are the numeric-band reconciliation the design explicitly retires (design.md:119-125, Resolved Questions "Confidence band"). C-rules are patches on the risk list so the band gate doesn't trip on non-material metadata.
- **Resolution**: not a workflow-order fix — spec requirement **"No self-scored confidence in the contract"** (spec.md:179-182) removes `band`/`auto_verification` entirely. The whole CF band apparatus (CF-2, CF-7) and its carve-out patches (CF-4, CF-5, CF-6) collapse to a typed `unresolvedRisks` category with a note (design.md:125). See §4 (stale rules).

---

## 3. Rules duplicated across sections (same policy stated twice or more)

- **D1 — `no_match` over false positive**: DC-1 `:670` == LID-DC-5 `:810`; the "prefer no_match / false positives are worse" policy also restated as DC-6 `:675` and OUT-7 `:775`. (bottle-classifier.md:73 "False positive existing-bottle matches are worse than no_match").
- **D2 — Candidates can be bottle or release; use `kind`/`releaseId`**: EC-2 `:705` == LID-EC-3 `:817`.
- **D3 — `familyContext` is evidence, not a deterministic rule**: EC-3 `:706` == LID-EC-4 `:818` (word-for-word except "child bottlings" vs "child releases").
- **D4 — Structured fields first, then names/aliases**: EC-4 `:707` == LID-EC-2 `:816`.
- **D5 — Ignore generic/package/SEO/volume/gift wording**: EC-5 `:708` == LID-EC-5 `:819` (identical).
- **D6 — Use local candidates first**: DC-7 `:676` (first clause) == LID-EC-1 `:815`.
- **D7 — Bottle identity definition** stated three times: ST-1 `:687` (`bottleIdentity`) + BC-1 `:722` ("A parent bottle is the stable marketed product family") + the Task/OUT framing. Same for **release identity**: ST-2 `:688` + BC-2 `:723` ("A release is the schema term for a reusable child bottling").
- **D8 — Observation-only facts (cask/bottle number, outturn, exclusives)**: ST-4 `:690` (`observationPolicy`) == OUT-11 `:779` ("Use `observation` for selector names, cask numbers, bottle numbers, outturn, market/exclusive wording") == BC-11/BC-24 partial.
- **D9 — `match` semantics**: DC-10 `:679` == OUT-1 `:769` (both define when to match an existing covering candidate).
- **D10 — Repair semantics**: DC-11 `:680` == OUT-2 `:770` (repair only for unsafe stored fields, not for optional-field enrichment).
- **D11 — `create_bottle_and_release` = missing parent, not dirty row**: BC-11 `:732` + BC-13 `:734` + OUT-5 `:773` all define the same action trigger.
- **D12 — Clean parent as `parentBottleId`, not the dirty sibling**: OUT-4 `:772` + OUT-10 `:778` + BC-14 `:735` state the same id-selection rule.
- **D13 — proposedBottle.name = evidenced canonical name, not retailer title**: OUT-12 `:780` == BC-24 `:745` (partial) == DC-13 `:682` (no-hybrid), also extractor policy.
- **D14 — exact_cask has no child releases**: BC-29 `:750` == identityScope section (bottle-classifier.md:283) == OUT-15 `:783` framing.
- **D15 — Judge web/source by specificity/independence/corroboration, not domain**: EC-6 `:709` restates the contract's evidence stance (bottle-classifier.md:245-247) inside the prompt.
- **D16 — toolsUsed = tools actually used**: CF-10 `:764` == LID-OUT-5 `:828`.
- **D17 — Keep bottle traits on proposedBottle / release traits on release**: OUT-17 `:785` == BC-6 `:727` == BC-23 `:744` (all say "family on bottle, marker on release").

Cross-prompt (classifier vs local) duplicates D1–D6 are acceptable per the
two-contract design, but within the classifier prompt D7–D17 are single-section
consolidation targets.

---

## 4. Stale rules / rules that contradict the spec requirements

- **S1 — Numeric confidence band (`auto_verification`)**: CF-2 `:756`, CF-7 `:761`, and the supporting carve-outs CF-4/CF-5/CF-6 `:758-760`. Contradicts spec **"Automation gating is derived by code from evidence" → "No self-scored confidence in the contract"** (spec.md:160-182) and design "Remove numeric confidence" (design.md:117-131). `confidenceBasis.band` is retired; the veto becomes a typed `unresolvedRisks` category.
- **S2 — `current_assignment` as a confidence value**: CF-8 `:762`. Design Resolved Questions (design.md:188) reclassifies current-assignment reaffirmation as _positive evidence_, not a confidence band. Stale.
- **S3 — Terminology `release` vs `bottling` used interchangeably**: pervasive — "release/bottling" at `:665, :672, :679, :705, :720, :725, :731, :743, :750, :769`; "child bottling" at `:723, :725, :739, :740`. Contradicts spec **"Terminology is consistent"** (spec.md:89-91) and design (design.md:99): pick one term (`release`) defined once in the bottle-identity model.
- **S4 — Undefined prompt-only jargon `dirty` / `clean parent` / `dirty sibling rows`**: BC-12 `:733`, BC-13 `:734`, BC-14 `:735`, BC-15 `:736`, BC-21 `:742`, OUT-10 `:778`. Contradicts spec **"Terminology is consistent"** (spec.md:89-91) / design "prompt-only phrases such as 'dirty sibling rows' and 'clean parent' without definitions" (design.md:99). Must be glossary-defined or replaced.
- **S5 — Web-search instructions with no tool-surface guard**: DC-7 `:676`, DC-8 `:677` direct the model to "use web search" / "rerun local search". Contradicts spec **"Instructions match the tool surface"** (spec.md:232-235) and design (design.md:104-109): `candidateExpansion = initial_only` runs this prompt with no tools attached. The prompt is also fully static via `buildBottleClassifierInstructions` ignoring its options (`instructions.ts:791-798`), so it cannot adapt — the input map must define no-tool behavior.
- **S6 — Missing input-map section (unexplained envelope fields)**: the prompt has no section covering `hasExactAliasMatch`, `candidateExpansion`, `investigationHint`, `currentBottle`, preloaded `webEvidence`. Contradicts spec **"Every input envelope field has semantics"** (spec.md:83-86) and **"Prompt section order"** (spec.md:207-210, requires an "input map" section). (Detailed field mapping is tasks.md 1.4.)
- **S7 — Missing candidate-field semantics `fullName` / `bottleFullName`**: EC-2 `:705` names only `kind` and `releaseId`; `familyContext` at EC-3 `:706`. `fullName` and `bottleFullName` are never explained. Contradicts spec **"Candidate field semantics are available"** (spec.md:78-81).
- **S8 — Section order and output order do not match the required layout**: current order is Decision Contract → Schema Terms → Evidence → Alias → Bottle/Bottling → Confidence → Output. Required order is task/success → input map → bottle identity model → evidence policy → decision workflow → action semantics → output contract (spec.md:207-210). Also the Output section lists the action enum (OUT-1..7) _before_ identityBasis (OUT-8), contradicting spec **"Evidence precedes the action in the output schema"** (spec.md:156-158). (Schema-shape reorder is tasks.md 3.1.)
- **S9 — No explicit success-criteria section**: DC-1 and the correctness bar are scattered in Decision Contract; spec **"Prompt section order"** wants a stable "task and success criteria" section.

---

## 5. Bottle-specific case law

The classifier prompt is deliberately brand-neutral — **no explicit brand or
product name appears** in `BOTTLE_CLASSIFIER_INSTRUCTIONS`, `BOTTLE_SCHEMA_RULES`,
or the local-identifier prompt. That is compliant with spec **"Examples do not
override policy"** (spec.md:222-225).

However, several rules are **product-class case law written as general prose** —
narrow guards that clearly encode one whisky segment's behavior and read as
exceptions rather than general policy:

- **CL1 — Chapter/volume/part labels**: BC-7 `:728` "Chapter, volume, part, batch, and annual labels under the same named series are bottling markers..." — targets series-with-chapters producers (e.g. Compass Box "Story of..."/blends). Reads as one family's modeling rule.
- **CL2 — American cask-strength vocabulary**: BC-19 `:740` "Cask-strength, barrel-proof, barrel-strength, full-proof, and single-barrel wording..." — a bourbon/American-whiskey-specific term list (barrel-proof/full-proof are US-market phrasings).
- **CL3 — Private-selection / single-barrel programs**: BC-20 `:741` "barrel-strength single-barrel/private-selection style reference..." — store-pick barrel-program case law.
- **CL4 — "private barrel or scene" photo case**: CF-3 `:757` "Lack of independent web corroboration for that exact private barrel or scene is not material..." — reads as a specific store-pick/label-photo fixture generalization.

These are not brand-named, so they do not violate the letter of the "no
case-law" rule, but they are the _pattern_ the design warns against (design.md:76,
"bottle-specific exceptions that contradict the general rules"). They should
fold into the general marker-gate step (see Pairs P4/P5) rather than enumerating
segment vocabularies.

**Genuine brand-named case law exists but is OUTSIDE the audited section**: the
extractor `RETAILER_LABEL_EXAMPLES` (`instructions.ts:155+`, e.g. "Total Wine",
"Grangestone Sherry Finish") and the worked examples in
`docs/architecture/whisky-identity-model.md:117-131` (Aberfeldy, Macallan,
Springbank, Maker's Mark, Octomore, SMWS). design.md:78 explicitly defers the
extractor retailer list to a follow-up.

---

## 6. Rule count and consolidation estimate

**Current classifier prompt: 92 rule bullets** (+2 task-header lines):

| Section                           | Bullets |
| --------------------------------- | ------- |
| Decision Contract (DC)            | 13      |
| Schema Terms (ST)                 | 11      |
| Evidence And Candidates (EC)      | 6       |
| Source And Alias Scope (AS)       | 4       |
| Bottle, Bottling, Exact Cask (BC) | 29      |
| Confidence (CF)                   | 10      |
| Output (OUT)                      | 19      |
| **Total**                         | **92**  |

(Local-identifier prompt adds 15 bullets, ~6 of them duplicates of classifier
rules; out of scope for consolidation.)

**Reductions available:**

- **Override pairs folded into ordered workflow steps** (§2): P1–P9 collapse ~18 competing BC/DC bullets (DC-4, DC-5, DC-9, BC-5, BC-15, BC-16, BC-17, BC-18, BC-19, BC-20, BC-21, BC-24, BC-25, BC-26, plus fragments) into roughly **8–10 ordered decision steps**. Net removal ≈ 10–12 bullets.
- **Confidence band removal** (§4 S1/S2, P10): CF-2, CF-4, CF-5, CF-6, CF-7, CF-8 (6 bullets) collapse to ~2 typed-risk rules. Net removal ≈ 4.
- **In-section duplicate removal** (§3 D7–D17): ≈ 8–10 bullets removed (bottle/release identity stated once in the identity model; match/repair/observation/parent-selection/proposedBottle.name each stated once).
- **Product-class case law generalized** (§5 CL1–CL4): 4 bullets fold into the marker gate. Net removal ≈ 3.

**Additions required by the spec** (not reductions): an input-map section (≈ 5–6
rules, tasks.md 1.4/2.2) and candidate-field semantics for `fullName` /
`bottleFullName` (≈ 2). These offset some of the removal.

**Estimated post-consolidation classifier rule count: ≈ 45–50 rules**, organized
as: task + success criteria (~3), input map (~6), bottle identity model /
glossary (~8), evidence policy and tool use (~5), ordered decision workflow
(~9–10 steps), action semantics (7 action definitions), output contract (~8).
Roughly a **45–50% reduction** in rule bullets, with every remaining override
pair expressed by step ordering rather than "overrides"/"however"/"unless"/
"solely" prose, satisfying spec **"Precedence lives in the workflow order"** and
**"Low-prose prompt cleanup"** (spec.md:212-220).
