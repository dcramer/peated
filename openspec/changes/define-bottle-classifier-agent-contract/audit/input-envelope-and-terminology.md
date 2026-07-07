# Input Envelope & Terminology Audit (tasks 1.4 + 1.5)

Scope: the serialized agent input produced by `buildAgentInput`
(`packages/bottle-classifier/src/runtime/agentInput.ts:14-71`) and the
terminology used across the classifier prompt
(`packages/bottle-classifier/src/instructions.ts`), tool schemas
(`tools/searchBottles.ts`, `tools/searchEntities.ts`), the output schema
(`classifierTypes.ts`), and the input envelope.

Prompt-side semantics referenced below come from
`BOTTLE_CLASSIFIER_INSTRUCTIONS` (`instructions.ts:664-789`) unless noted.
`buildBottleClassifierInstructions` **ignores** its `hasBottleSearch`,
`hasEntitySearch`, and `maxSearchQueries` arguments
(`instructions.ts:791-798`, `void _options`), so the prompt text is identical
for every non-`local_identification` run regardless of the attached tools.

---

## A. Input envelope map

Serialized shape (from `agentInput.ts:42-70`):

```
reference: { id, name, url, imageUrl, currentBottleId, currentReleaseId }
candidateExpansion
currentBottle
extractedIdentity
imageEvidence
localSearch: { hasExactAliasMatch, candidates[] }
webEvidence: { results[] }
localEntitySearch: { results[] }
investigationHint
```

Legend for **Prompt explanation**: quote + `instructions.ts` line, or **NONE**.

### Top-level container: `reference` (`agentInput.ts:44-51`)

| Field                                | Prompt explanation                                                                                                                                    | Unexplained misread risk                                                                                                                                                                        | Verdict                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference.id` (`:45`)               | NONE. Only used by code for tracing (`classifierRuntime.ts:1014-1017`).                                                                               | Model may read a source/site id as a Peated `bottleId`/`matchedBottleId` and echo it into a decision.                                                                                           | **REMOVE** — internal correlation id; the agent never needs it.                                                                                                |
| `reference.name` (`:46`)             | Implicit only: "classify one whisky reference" (`:665`). Never labeled as _the observed source label / primary input_.                                | The single most important input has no named semantics; model may treat it as canonical rather than evidence, contradicting the "raw source facts remain evidence" requirement (spec `:22-24`). | **EXPLAIN** — "`reference.name` is the observed source label (retailer/review/user title); evidence to interpret, not canonical identity."                     |
| `reference.url` (`:47`)              | NONE.                                                                                                                                                 | Model may treat a source-page URL as gathered web evidence, or ignore it. It is source-page provenance the model may cite.                                                                      | **EXPLAIN** — "`reference.url` is the source page the label came from; source-page evidence, not a web-search result."                                         |
| `reference.imageUrl` (`:48`)         | NONE (prompt mentions "uploaded label photo" at `:757` but never the field).                                                                          | Model may expect to fetch/read the image; it cannot — image content is pre-extracted into `imageEvidence`.                                                                                      | **EXPLAIN** — "`reference.imageUrl` points to the submitted photo; its readable content is already in `imageEvidence`."                                        |
| `reference.currentBottleId` (`:49`)  | Partial: `current_assignment` band "only when cleanly reaffirming the current bottle/release assignment" (`:762`). Field name never tied to the band. | Model may not connect this id to `confidenceBasis.band = current_assignment` or to the hydrated `currentBottle`.                                                                                | **EXPLAIN** — "`reference.currentBottleId`/`currentReleaseId` is the reference's existing Peated assignment; reaffirming it is `current_assignment` evidence." |
| `reference.currentReleaseId` (`:50`) | Partial (as above).                                                                                                                                   | As above.                                                                                                                                                                                       | **EXPLAIN** (same one-liner).                                                                                                                                  |

### `candidateExpansion` (`agentInput.ts:52`)

| Field                                             | Prompt explanation | Misread risk                                                                                                                                                                                                                         | Verdict                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `candidateExpansion` (`"initial_only" \| "open"`) | NONE.              | An internal mode flag that governs **tool attachment in code** (`classifierRuntime.ts:924,940-987`), not model behavior. Model may try to interpret it, or (worse) in `initial_only` it does not tell the model that tools are gone. | **REMOVE** from the envelope. Tool availability is already expressed by the attached tool set; the mode belongs in the (currently static) instructions, not as a data field the model must decode. (See Part C.) |

### `currentBottle` (`agentInput.ts:53`)

| Field                                                                        | Prompt explanation                                                                                                                     | Misread risk                                                                                                                                                                | Verdict                                                                                                                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentBottle` (hydrated `BottleCandidate`, `classifierRuntime.ts:897-922`) | Partial: "the current/local target identity" (`:680`), `current_assignment` (`:762`). The envelope key `currentBottle` is never named. | Model may not realize this is the _already-assigned_ record (distinct from `localSearch.candidates`), or may double-count it (it is also merged into candidates at `:921`). | **EXPLAIN** — "`currentBottle` is the reference's current Peated assignment hydrated as a candidate; use it for `current_assignment` reaffirmation and repair decisions." |

### `extractedIdentity` (`agentInput.ts:54`)

| Field                                                                                   | Prompt explanation                                                                                                                                                                                                                                                                                                                                          | Misread risk                                                                                                                                                   | Verdict                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractedIdentity` (`BottleExtractedDetails`, 13 fields, `classifierTypes.ts:163-179`) | Partial: "Schema Terms" defines `brand`/`bottler`/`distillery`/`expression`/`series`/`edition`/`category` (`:692-697`) but frames them as output/schema terms, not as this envelope object; `stated_age`/`abv`/`vintage_year`/`release_year`/`cask_strength`/`single_cask` are not tied to it. Also uses `snake_case` here vs `camelCase` in output schema. | Model may treat extractor output as ground truth rather than another evidence layer, and may not map `stated_age -> statedAge` etc. across the case-style gap. | **EXPLAIN** — "`extractedIdentity` is the label-extractor's structured guess (evidence, may be wrong/sparse); fields mirror the extractor schema in snake_case." |

### `imageEvidence` (`agentInput.ts:55`)

| Field                                                                                                                                 | Prompt explanation                                                                                                                                                                                                        | Misread risk                                                                                                                                            | Verdict                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imageEvidence` (`ImageBottleEvidence`: `extractors`, `fieldCandidates`, `photoSuitability`, `conflicts`; `imageEvidence.ts:120-129`) | Partial: "For a readable uploaded label photo, label-visible … details are primary source evidence" (`:757`). The nested structure (`fieldCandidates` w/ confidence, `photoSuitability`, `conflicts`) is never explained. | Model cannot tell high-confidence OCR spans from low, may ignore `conflicts`/`photoSuitability`, and cannot weight image vs text evidence deliberately. | **EXPLAIN** — one line naming the sub-objects: "`imageEvidence.fieldCandidates` are per-field OCR/vision guesses with confidence; `photoSuitability`/`conflicts` flag unreliable photos and disagreements." |

### `localSearch` container (`agentInput.ts:56-59`)

| Field                                    | Prompt explanation                                                                        | Misread risk                                                                                                                                                                                                                                                         | Verdict                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localSearch.hasExactAliasMatch` (`:57`) | NONE. Derived from `candidate.source.includes("exact")` (`classifierRuntime.ts:883-885`). | A `true` flag reads as "an exact match exists — just match it," which directly contradicts the "candidates are evidence not commands" requirement (spec `:74-76`) and the note that exact rows can be dirty legacy bottlings (`:678,736`). High false-positive risk. | **EXPLAIN** (preferred) — "`hasExactAliasMatch = true` means a candidate's alias exactly equals the reference; it is a strong signal, not an instruction to match — still check dirty/legacy rows." OR **REMOVE** and let the model read `candidate.source`. Recommend EXPLAIN because the derived flag is otherwise invisible. |

### `localSearch.candidates[]` — each `BottleCandidate` (`classifierTypes.ts:181-222`)

| Field                                                                                                                                                             | Prompt explanation                                                                                                                                            | Misread risk                                                                                                                                                               | Verdict                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `kind` (`:183-188`)                                                                                                                                               | "Candidates can be bottle or release/bottling targets. Use `kind` and `releaseId`." (`:705`) + schema `.describe` (`classifierTypes.ts:186`).                 | Low.                                                                                                                                                                       | keep — explained.                                                                                                                     |
| `bottleId` (`:189`)                                                                                                                                               | NONE (obvious from `matchedBottleId`/`parentBottleId` output).                                                                                                | Low.                                                                                                                                                                       | **EXPLAIN** (brief) — "`bottleId` is the parent bottle id to return as `matchedBottleId`/`parentBottleId`."                           |
| `releaseId` (`:190`)                                                                                                                                              | "Use `kind` and `releaseId`" (`:705`); "must be paired with the parent `bottleId`" (design `:94`, not in prompt).                                             | Medium: pairing rule lives in design, not prompt.                                                                                                                          | **EXPLAIN** — add the pairing rule to the input map.                                                                                  |
| `alias` (`:191`)                                                                                                                                                  | NONE.                                                                                                                                                         | Model may confuse `alias` (the matched local alias) with the source label or with `aliasScope`.                                                                            | **EXPLAIN** or **REMOVE** — recommend brief EXPLAIN: "`alias` is the local alias text this candidate matched on."                     |
| `fullName` (`:192`)                                                                                                                                               | **NONE.**                                                                                                                                                     | Named in spec scenario as required (`:81`) and design (`:92`). Without it the model does not know `fullName` is the candidate's display string (may include release text). | **EXPLAIN** — "`fullName` is the candidate's display string (may include release text)."                                              |
| `bottleFullName` (`:193`)                                                                                                                                         | **NONE.**                                                                                                                                                     | Required by spec (`:81`)/design (`:93`). Model cannot tell parent display string from candidate display string on release candidates.                                      | **EXPLAIN** — "`bottleFullName` is the parent bottle display string when the candidate is a release."                                 |
| trait fields: `brand`,`bottler`,`series`,`distillery`,`category`,`statedAge`,`edition`,`caskStrength`,`singleCask`,`abv`,`vintageYear`,`releaseYear` (`:194-217`) | Partial via Schema Terms (`:692-697`) + component priority (`:702-703`). Not tied to candidate object.                                                        | Medium: naming overlaps output/extraction fields; model may not know these are the candidate's _stored_ values to compare against.                                         | **EXPLAIN** (one line) — "the remaining candidate fields are the stored canonical values to compare component-by-component."          |
| `score` (`:218`)                                                                                                                                                  | Negative only: "Choose the parent … not by highest score alone" (`:735`); `familyContext`/rank must not override evidence (spec `:74-76`). Field never named. | Model may rank by `score` despite the spec forbidding rank-driven matches.                                                                                                 | **EXPLAIN** — "`score` is local search rank; a retrieval hint only, never proof of a match." (Or REMOVE to eliminate the temptation.) |
| `source` (`:219`)                                                                                                                                                 | NONE (feeds `hasExactAliasMatch`).                                                                                                                            | Opaque provenance strings ("exact", search source); model may over-trust.                                                                                                  | **EXPLAIN** briefly, or REMOVE if `hasExactAliasMatch` stays.                                                                         |
| `familyContext` (`:220`)                                                                                                                                          | "`familyContext` is evidence about sibling bottles and child bottlings; it is not a deterministic rule." (`:706`).                                            | Nested fields (below) unexplained.                                                                                                                                         | keep top-level; explain nesting.                                                                                                      |

#### `familyContext` nested (`classifierTypes.ts:144-161`)

| Field                                    | Prompt explanation                                                                                         | Misread risk                                                                                                    | Verdict                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parentBottleReleaseTraits` (`:146-151`) | NONE in prompt (schema `.describe` only). This is the machine-readable signal for a "dirty/legacy parent." | Model relies on prose ("dirty sibling rows", `:733,742`) instead of this typed field; the two are never linked. | **EXPLAIN** — "`familyContext.parentBottleReleaseTraits` = release-like traits stored on the parent row; this is what makes a parent 'dirty'/legacy." |
| `childReleaseCount` (`:152`)             | NONE.                                                                                                      | Model cannot use it to judge "existing child releases prove bottling capacity" (`:743`).                        | **EXPLAIN** briefly.                                                                                                                                  |
| `siblingReleases[]` (`:153`)             | Partial: "sibling releases prove that marker type" (`:733`).                                               | Field name not tied to prose.                                                                                   | **EXPLAIN** briefly.                                                                                                                                  |
| `siblingBottles[]` (`:154-159`)          | NONE in prompt (schema `.describe` only).                                                                  | Model cannot mechanically use sibling bottle rows for bottle-vs-release placement.                              | **EXPLAIN** briefly.                                                                                                                                  |

### `webEvidence.results[]` (`agentInput.ts:60-62`)

| Field                                                                          | Prompt explanation                                                                                                                                                                             | Misread risk                                                                                                                                                                                                   | Verdict                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webEvidence.results` (`BottleSearchEvidence[]`, `classifierTypes.ts:232-237`) | Partial: prompt discusses "web search"/"web evidence" extensively (`:676,677,709,758`) but as something the model _gathers via tools_, never as **preloaded** results already in the envelope. | Model may re-run web search that was already done, or not realize results are pre-attached; on `initial_only` runs it is the only web evidence available yet the prompt tells it to "use web search" (Part C). | **EXPLAIN** — "`webEvidence.results` are web-search results already gathered before this pass (from firecrawl/openai); judge them by content, do not assume you must search again." |

### `localEntitySearch.results[]` (`agentInput.ts:63-65`)

| Field                                                                            | Prompt explanation                                                                                                                                           | Misread risk                                                                                                                                                                                           | Verdict                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localEntitySearch.results` (`EntityResolution[]`, `classifierTypes.ts:684-692`) | **NONE.** Prompt never mentions resolved entities in the envelope; only `confidenceBasis.toolsUsed` enum lists `search_entities` (`classifierTypes.ts:479`). | Model does not know pre-resolved brand/distillery/bottler entities are available to fill `proposedBottle.brand.id`/`distillers[].id` (which otherwise default to `id: null`, `:786`). Unused evidence. | **EXPLAIN** — "`localEntitySearch.results` are resolved Peated entities (brand/distillery/bottler ids) usable to populate proposed `{id,name}` fields." |

### `investigationHint` (`agentInput.ts:66`)

| Field                                  | Prompt explanation                                                                                                                                             | Misread risk                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Verdict                                                                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `investigationHint` (`string \| null`) | **NONE** — the field name is never referenced; its _content_ is free-form instruction prose injected by code (`classifierRuntime.ts:1383-1386`, `:1428-1429`). | This is a **dynamic instruction smuggled through the data channel**: it competes with the static prompt (e.g. "use local search tools if the evidence suggests a better database candidate") and directly violates the "instructions are static per mode" requirement (spec `:227-230`) and the tool-surface rule (spec `:232-235`) — on `initial_only` no tools exist. Two different hint strings also mean the effective prompt is not stable, breaking prompt-cache intent. | **REMOVE** from the envelope. Fold its durable content into the static per-mode instructions; the transient "web evidence was gathered because no exact alias" state is already conveyed by `hasExactAliasMatch` + populated `webEvidence.results`. |

### Unexplained-field tally

Counting the distinct serialized fields with a **NONE** prompt explanation
(partial explanations excluded):
`reference.id`, `reference.url`, `reference.imageUrl`, `candidateExpansion`,
`hasExactAliasMatch`, `candidate.bottleId`, `candidate.alias`,
`candidate.fullName`, `candidate.bottleFullName`, `candidate.source`,
`familyContext.parentBottleReleaseTraits`, `familyContext.childReleaseCount`,
`familyContext.siblingBottles`, `localEntitySearch.results`,
`investigationHint` = **15 fully-unexplained fields**.

Adding the partially/indirectly explained fields that still need explicit
input-map semantics (`reference.name`, `reference.currentBottleId`,
`reference.currentReleaseId`, `currentBottle`, `extractedIdentity`,
`imageEvidence`, `candidate.releaseId`, candidate trait block, `candidate.score`,
`familyContext.siblingReleases`, `webEvidence.results`) brings the total needing
input-map work to ~26.

### Explain-vs-Remove split

- **REMOVE (4):** `reference.id`, `candidateExpansion`, `investigationHint`, and
  (conditionally) `candidate.score`/`candidate.source` if `hasExactAliasMatch`
  is retained as the pre-derived signal.
- **EXPLAIN (all remaining, ~22):** everything else needs a one-line input-map
  entry. Highest priority (spec-named, zero current coverage, decision-changing):
  `fullName`, `bottleFullName`, `hasExactAliasMatch`, `localEntitySearch.results`,
  `webEvidence.results` (preloaded framing), and
  `familyContext.parentBottleReleaseTraits`.

---

## B. Terminology conflicts

Each row: concept, every variant with locations, recommended single glossary
term (prefer the schema field name), and a one-line glossary definition.

### 1. release vs bottling ← highest-impact conflict

- **`release`**: schema field `releaseId` (`classifierTypes.ts:190`),
  `proposedRelease`, action `create_release`, `identityBasis.releaseTraits`
  (`:421`), `BOTTLE_SCHEMA_RULES.releaseIdentity` (`bottleSchemaGuidance.ts:4`).
- **`bottling`**: used interchangeably with release throughout the prompt —
  `instructions.ts:665` ("bottle/release (bottling) candidates"), `:671, :672,
:673, :678, :679, :681, :705, :725, :727, :728, :730, :731, :732, :733, :734,
:743, :769, :772, :774`.
- **`child bottle_release`**: schema `.describe` (`classifierTypes.ts:187`).
- **Recommended term:** **`release`** (matches schema field `releaseId` /
  `proposedRelease`). Drop "bottling" as a synonym entirely.
- **Glossary def:** "Release — a reusable child identity under a parent bottle
  that aggregates users, prices, and stats, distinguished by edition, year, ABV,
  cask, or single-cask/cask-strength markers."

### 2. parent bottle vs family vs stable parent

- **`parent bottle`**: `instructions.ts:722` ("A parent bottle is the stable
  marketed product family"), output field `parentBottleId`
  (`classifierTypes.ts:534,554`).
- **`family` / `stable family`**: `instructions.ts:671, :678, :679, :726, :727,
:728, :730, :731, :733, :734, :735, :774`.
- **`stable parent`**: spec `:42-44`, schema `.describe`
  (`classifierTypes.ts:417`).
- **`marketed product family`**: `instructions.ts:722`.
- **Recommended term:** **`parent bottle`** (matches `parentBottleId` /
  `kind=bottle`). Use "family" only inside the phrase "parent bottle family"
  when needed, never as a standalone synonym.
- **Glossary def:** "Parent bottle — the stable marketed product family record
  (`kind=bottle`, `bottleId`); the default object for tasting, search, and
  collection."

### 3. clean parent (distinct adjective concept)

- **`clean parent`**: `instructions.ts:681, :723, :729, :731, :733, :735, :742,
:772, :774, :778`.
- Machine signal is `familyContext.parentBottleReleaseTraits` being empty
  (`classifierTypes.ts:146-151`) — but the prompt never links the phrase to the
  field.
- **Recommended term:** **`clean parent bottle`**, defined once against the
  typed field.
- **Glossary def:** "Clean parent bottle — a parent bottle whose row stores no
  release-specific traits (`familyContext.parentBottleReleaseTraits` empty), so
  a child release can attach without repair."

### 4. dirty sibling rows / legacy bottling rows / dirty same-family row

- **`legacy bottling rows`**: `instructions.ts:678, :728`.
- **`dirty sibling rows` / `dirty sibling`**: `instructions.ts:733, :742, :778`.
- **`dirty same-family row`**: `instructions.ts:734, :735`.
- **`dirty/exact child-like row`**: `instructions.ts:772`.
- **`dirty legacy bottlings`**: `instructions.ts:736`.
- Schema counterparts: `familyContext.parentBottleReleaseTraits`
  (`classifierTypes.ts:146-151`, "legacy or single-known-release data"),
  `identityBasis.siblingEvidence` enum value **`dirty_sibling_candidates`**
  (`classifierTypes.ts:446`).
- **Recommended term:** **`dirty bottle row`** (aligns with the enum stem
  `dirty_sibling_candidates`).
- **Glossary def:** "Dirty bottle row — a `kind=bottle` row that stores
  release-specific traits (has `familyContext.parentBottleReleaseTraits`); it is
  a legacy/single-release parent, not a clean parent, and not a safe exact
  match by name alone."

### 5. edition vs batch vs release code

- **`edition`**: schema field on `extractedIdentity` (`classifierTypes.ts:177`),
  `BottleCandidate` (`:200`), `proposedBottle`/`proposedRelease` (`:295, :321`),
  `identityBasis` describe (`:421`).
- **`batch` / `batch code` / `release code` / `store-pick code`**: prompt
  `instructions.ts:674, :696, :725, :728, :731`; extractor guidance
  `instructions.ts:80-88, :146-153`.
- **Recommended term:** **`edition`** (schema field). Enumerate batch/store-pick/
  release-code as _examples that populate `edition`_, not as separate terms.
- **Glossary def:** "Edition — the `edition` field string carrying a batch,
  store-pick code, release code, or numbered variant that differentiates a
  release."

### 6. expression vs core bottle name vs core release name ← definitional conflict

- **`expression`**: schema field (`classifierTypes.ts:167`, extractor).
- Defined as **"core bottle name"**: `instructions.ts:695`.
- Defined as **"core release name"**: extractor guidance `instructions.ts:66`,
  and tool schema `tools/searchBottles.ts:42` ("Core release name after
  removing brand, age, ABV…").
- Also **"core expression name"**: `MATCH_COMPONENT_PRIORITY`
  (`instructions.ts:143`).
- **Conflict:** the same field is defined as _bottle_ name in the classifier
  prompt but _release_ name in the extractor + search tool — the exact
  bottle-vs-release ambiguity the contract is trying to eliminate.
- **Recommended term:** **`expression`**, defined once as bottle-level.
- **Glossary def:** "Expression — the core bottle name after removing producer,
  age, ABV, and generic style words; bottle-level identity (not release-level)."
  Update `searchBottles.ts:42` and extractor `instructions.ts:66` to say
  "bottle" not "release."

### 7. exact_cask vs single cask (must stay distinct)

- **`exact_cask`**: `identityScope` enum value (`classifierTypes.ts:396`),
  prompt `instructions.ts:748-750, :783`.
- **`single cask` / `singleCask`**: trait flag on candidates/proposals
  (`classifierTypes.ts:200, :298`), extractor `single_cask` (`:176`).
- These are correctly different (scope vs trait) but the prose "exact cask"
  and "single cask/single-cask" sit close together (`:740-750`) and can blur.
- **Recommended:** keep **`identityScope = exact_cask`** vs **`singleCask`
  (trait)** as separate glossary entries with an explicit "not the same as" note.
- **Glossary def:** "`exact_cask` — identityScope where the specific cask _is_
  the marketed bottle (e.g. SMWS); never spawns a child release. `singleCask` —
  a boolean trait; a bottle can be single-cask without being `exact_cask`."

### 8. source label: reference / listing title / source title / retailer title

- **`reference` / `reference.name`**: contract (`contract.ts:91`), prompt
  "one whisky reference" (`instructions.ts:665`).
- **`listing title`**: `instructions.ts:715, :716`.
- **`retailer title`**: `instructions.ts:780, :782`.
- **`source title`**: extractor `instructions.ts:587, :592`.
- **`observed reference` / `observed … identity`**: spec `:9, :22`.
- **Recommended term:** **`source label`** (= `reference.name`), with
  "retailer/listing/review title" as descriptive examples.
- **Glossary def:** "Source label — the observed `reference.name` (retailer,
  review, or user-entered title); evidence to interpret, never canonical
  identity."

### 9. band value `auto_verification` (minor)

- Enum value `auto_verification` (`classifierTypes.ts:456`) vs prose
  "automatic verification" (`classifierTypes.ts:459`, `instructions.ts:756`).
  Cosmetic; note only. (Per design, `confidenceBasis.band` is being retired, so
  no action needed beyond removal.)

---

## C. Tool-surface consistency

`buildBottleClassifierInstructions` returns the same static string for both
`open` and `initial_only` runs and **ignores** `hasBottleSearch`/`hasEntitySearch`
(`instructions.ts:791-798`). Tool attachment is decided separately in
`classifierRuntime.ts:924-987`. This produces the following mismatches.

### C1. `initial_only` runs the full prompt with zero tools

- Code: `allowCandidateExpansion = candidateExpansion === "open"`
  (`classifierRuntime.ts:924`); `const tools = allowCandidateExpansion ? [ … ] : []`
  (`:940-987`). So `initial_only` attaches **no tools at all**.
- Yet the prompt still directs tool use:
  - "Use local candidates first; use web search for disputed, missing, or
    create-critical traits. … search contrastively …" (`instructions.ts:676`).
  - "Creation requires supportive web evidence and a local candidate check …
    rerun local search when web evidence reveals a decisive trait …"
    (`instructions.ts:677`).
  - "rerun local search when web evidence reveals a decisive trait not already
    covered by provided candidates" (`:677`).
  - "List only tools actually used in `confidenceBasis.toolsUsed`" (`:764`) with
    an enum offering `search_bottles`/`openai_web_search`/`firecrawl_web_search`
    (`classifierTypes.ts:475-483`).
- This violates spec `:232-235` ("SHALL NOT direct the model to call tools that
  are not attached").
- **Resolution (static per mode):** add a distinct static instruction constant
  for `initial_only` (mirroring how `local_identification` already branches at
  `classifierRuntime.ts:930-938`) whose evidence/tool section says: "No retrieval
  tools are available on this pass. Decide only from the provided envelope
  (`localSearch.candidates`, `webEvidence.results`, `extractedIdentity`,
  `imageEvidence`). If a decisive trait is unverifiable from the envelope, return
  `no_match` rather than assuming a search you cannot run." Set
  `toolsUsed = ["initial_local_candidates"]` expectations accordingly.

### C2. Entity search is optional but the prompt is fixed

- Code: `search_entities` attaches only when `dataSource.searchEntities` exists
  **and** `allowCandidateExpansion` (`classifierRuntime.ts:937, :950-961`).
- The prompt body never directs `search_entities` use (only the tool's own
  description does, `tools/searchEntities.ts:13-14`), yet
  `confidenceBasis.toolsUsed` lists `search_entities` (`classifierTypes.ts:479`)
  and `localEntitySearch.results` is always serialized (`agentInput.ts:63-65`)
  even when the tool is absent.
- **Resolution:** keep entity guidance out of the static prose (it is fine to
  rely on the tool description), but make the input map state that
  `localEntitySearch.results` may be present as preloaded evidence, and that the
  `search_entities` tool "may or may not be attached — use it only if listed in
  your tool set." Do not name `search_entities` in `toolsUsed` guidance for the
  `initial_only`/no-entity modes.

### C3. firecrawl vs openai web search — exactly one, model-blind

- Code: firecrawl attaches when `firecrawlApiKey` is set
  (`classifierRuntime.ts:962-973`); openai attaches only when
  `!useFirecrawlWebSearch`, i.e. when firecrawl is absent
  (`:928-929, :974-985`). So in `open` mode exactly one web tool is present; in
  `initial_only` neither is present.
- The prompt says generic "web search" and the `toolsUsed` enum offers **both**
  `openai_web_search` and `firecrawl_web_search` (`classifierTypes.ts:475-483`),
  so the model must name a provider it cannot see chosen.
- **Resolution:** the prompt should refer only to "the web search tool"
  generically (it already mostly does) and instruct the model to report the web
  tool by whatever name appears in its attached tool set; do not enumerate both
  provider names as if the model chooses. The provider distinction is a code
  concern and can be normalized post-hoc when recording `toolsUsed`.

### Tool-surface mismatch tally

**3 tool-surface mismatches**: (C1) full prompt + zero tools on `initial_only`;
(C2) fixed prompt/`toolsUsed`/`localEntitySearch` regardless of whether
`search_entities` is attached; (C3) both web-provider tool names exposed while
only one (or none) is attached. Root cause for all three: `instructions.ts:795-797`
discards the tool-surface flags the runtime already computes, so the prompt is
never reconciled with the attached tool set.
