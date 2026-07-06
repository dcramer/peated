# Bottle Classifier

This spec defines the reviewed boundaries for turning a raw bottle reference
into Peated bottle identity evidence or a Peated DB outcome. Price matching,
review ingestion, repair tools, and other consumers should use these boundaries
instead of redoing identity reasoning.

## Contract

The package has three distinct contracts:

- `extractBottleReferenceIdentity(...)`: reads bottle identity facts from image
  or text. It does not decide whether the facts are canonical Peated identity.
- `identifyExistingBottleReference(...)`: proposed match-only local
  identification. It can return only `match` or `no_match`, must use local
  Peated candidates, and must not create, repair, or infer missing canonical
  identity.
- `classifyBottleReference(...)`: full reviewed classification. It can match,
  create, repair, or decline after considering local candidates, entity
  resolution, and web evidence when required.

`classifyBottleReference(...)` accepts a generic reference:

- `name`
- optional `url` and `imageUrl`
- optional current bottle/release ids
- optional trace metadata
- optional seeded extracted identity or candidates for closed review flows

It returns either `ignored` with a reason, or `classified` with:

- a reviewed decision
- `extractedIdentity`
- local candidates used for reasoning
- web/search evidence used for reasoning
- resolved brand, bottler, and distillery entities

Decision actions are `match`, `repair_bottle`, `create_bottle`,
`create_release`, `create_bottle_and_release`,
`repair_parent_and_create_release`, and `no_match`.

The classifier is bottle-centric. Price-match terms such as `match_existing`,
`correction`, and `create_new` are downstream proposal policy, not classifier
policy.

## Correctness Bar

The classifier should first identify the observed bottle family and exact
release/bottling details, then choose the safest Peated DB outcome for that
target.

- Treat local Peated search as prior-art evidence: it answers whether the exact
  target already exists and shows nearby modeling patterns. Nearby local rows
  must not erase clear source identity.
- Match an existing candidate only when it covers the identified bottle and
  release/bottling identity without unsupported extra identity traits.
- Create a bottle or release only when reviewed source, label, image,
  local-catalog, or web evidence supports the missing canonical identity.
  Automatic verification of creation requires corroborating evidence or a
  closed-form deterministic anchor.
- Repair and enrichment are secondary to identity routing. Missing optional
  fields, questionable catalog metadata, or non-target-defining repair
  opportunities should be recorded as observations or downstream repair work;
  they should not block a clear match or create outcome.
- Use repair actions only when a stored field conflict makes the selected target
  identity unsafe.
- Use `repair_parent_and_create_release` when a supported child release cannot
  safely be created until an existing parent bottle is repaired into a clean
  reusable parent.
- Return `no_match` only when the bottle/release identity is unresolved or when
  creating would invent an ambiguous hybrid.

False positive existing-bottle matches are worse than `no_match` or reviewed
creation.

Existing-bottle identification and full canonical classification have different
evidence bars:

- Local identification may stop at an existing match when local evidence is
  sufficient for the requested workflow. It must return `no_match` when the
  local evidence is ambiguous, incomplete, or requires canonical interpretation.
- Full classification is required when the caller wants a create, repair,
  release, parent-repair, or other canonical DB outcome.
- Web evidence is not required for every existing local match. It is one way to
  corroborate missing canonical identity, but creation and release outcomes may
  also be supported by reviewed label/image evidence, closed-form deterministic
  anchors, or explicit local parent/sibling evidence where policy allows them.
- Manual-search consumers should treat `no_match` as unresolved identity, not as
  a generic fallback for clear identities that happen to expose catalog repair
  or enrichment work.

## Execution

### Full Classification

The pipeline is:

1. Extract structured identity from image or text.
2. Ignore obvious non-whisky and non-single-bottle rows.
3. Retrieve local bottle/release candidates.
4. Run deterministic resolvers before the agent. Today this is limited to SMWS
   code references.
5. Resolve local brand, bottler, and distillery entities.
6. Preload targeted web evidence when local candidates are missing or unsafe.
7. Run one classifier agent with local search, entity search, and web search
   tools.
8. Validate model output against known candidates and resolved entities.
9. Normalize create and repair drafts.
10. Downgrade impossible decisions and decisions with concrete conflicts.

Downstream code may gate persistence and automation. It should not promote a
semantic identity decision the classifier did not make.

### Local Identification

The proposed match-only local identification pipeline is:

1. Accept already-extracted identity and image/text evidence.
2. Retrieve local bottle/release candidates.
3. Return a strict deterministic match only for an unambiguous literal stored
   alias or other closed-form local id assertion.
4. Otherwise run a local-identification agent with local bottle search tools
   only.
5. Return `match` only when an existing bottle or release safely covers the
   marketed identity; otherwise return `no_match`.

Local identification must not use web search, create bottles, create releases,
repair bottles, repair parents, or normalize a missing bottle into existence.
If the caller needs those outcomes, it should fall through to full
classification.

## Determinism

Deterministic code is allowed for closed-form behavior:

- schema validation
- normalization
- known-id validation
- impossible-state blocking
- confidence caps and automation gates
- exact identity anchors such as SMWS bottle codes
- unambiguous literal stored alias lookup for match-only local identification
- direct field contradictions, such as an extracted brand, category, distillery,
  stated age, ABV, vintage year, release year, cask flag, expression, or edition
  that conflicts with the matched local candidate

Deterministic code is not allowed for whisky-family semantics. Brand prefixes,
years, batch-like tokens, `single cask`, `barrel`, producer names, domain names,
retailer wording, vector similarity, text-search rank, fuzzy aliases, and
comparable-name matches are not enough to choose bottle versus release scope,
create canonical identity, or bypass agent judgment.

Post-agent deterministic review must not turn a classifier `match` into
`no_match` merely because code cannot prove the match from local text, fuzzy
name comparison, search rank, or structured-support heuristics. Missing
deterministic support can cap automation confidence or require review, but only
binary invalid state or direct extracted-field conflict may erase the agent's
semantic match.

A literal stored alias shortcut is allowed only when the normalized input
matches a non-ignored stored alias attached to exactly one bottle or release. If
there are multiple targets, fuzzy/comparable-only matches, release-parent
ambiguity, or any required whisky interpretation, fall through to the agent.

If behavior depends on brand context, marketed family meaning, source quality,
or whether a fact is canonical versus observational, it belongs to the agent and
review policy.

### Review Policy Audit

`reviewPolicy.ts` is a final safety gate, not a second classifier. Audit changes
there against this boundary:

- Keep schema normalization, unknown-id rejection, impossible-state rejection,
  non-whisky rejection, and confidence caps that enforce explicit automation
  contracts.
- Keep checks that validate the selected target exists in the reviewed candidate
  set.
- Keep direct extracted-field conflict rejection only for explicit conflicts on
  populated fields.
- Remove or narrow checks that re-score names, infer family modeling, require
  local text-rank proof, or turn a clear agent match/create into `no_match`
  because the catalog row is incomplete or has non-target-defining cleanup work.
- Remove or narrow caps that treat lack of web corroboration as a blocker when
  the source label, image evidence, local candidates, or a closed-form anchor
  already supports the exact target.
- Prefer adding an eval that proves the agent decision is right before relaxing
  a review-policy gate. Only relax the gate when the remaining failure is the
  gate itself.

## Agent Judgment

Use the agent for:

- source interpretation and reliability
- bottle versus release placement
- source fact versus canonical identity
- over-specific candidate detection
- supportive, weak, conflicting, or unnecessary web-evidence judgment
- match decisions that are not closed-form local id assertions

The full classifier agent must fill `identityBasis` and `confidenceBasis` for
reviewed decisions. `confidenceBasis.webEvidence = supportive` is required
before automation can treat web-backed create evidence as validated.

## Evidence And Tools

Source pages, snippets, search results, and retailer titles are evidence, not
policy.

The classifier does not maintain producer, critic, database, or retailer domain
allowlists. The agent judges source quality from content, independence,
specificity, and corroboration. Code may separate the originating listing from
other web results; it must not infer truth from a hardcoded domain class.

The originating retailer can support extraction, but it is not decisive creation
evidence by itself.

The full classifier agent has read-only tools for local candidates, local
entities, and live web evidence:

- `search_bottles`: local Peated bottle and release candidates
- `search_entities`: local Peated brand, distillery, and bottler entities
- `firecrawl_web_search`: configured default live web evidence search with
  scraped page excerpts
- `openai_web_search`: no-Firecrawl fallback web evidence search

Tool descriptions should state what the tool searches, what arguments mean, what
it returns, and any hard limits. Put classifier policy in the stable prompt or
review policy, not in tool prose.

Add source-specific tools only when they return materially better structured
evidence than general web search and preserve the same trust boundary.

A local-identification agent should have a narrower tool set: local bottle
search, and entity search only when it materially improves matching. It should
not have web-search tools because it is not allowed to create, repair, or assert
new canonical identity.

## Identity Scope

`identityScope = product` is the default stable bottle-family identity.

Use `identityScope = exact_cask` only when the exact cask is the marketed bottle
identity. SMWS code references qualify because the code is the bottle identity
anchor. Generic cask or barrel wording does not qualify without reliable evidence
that the product is marketed as that exact single-cask identity.

Exact-cask identity does not create child releases.

## Evals

Classifier evals should score final action, ids, create drafts, release scope,
required fields, incorrect fields, and confidence calibration. Encoded expected
fields are required. Missing unencoded optional enrichment can be tolerated;
wrong required identity fields should fail.

Local-identification evals should be scored separately from full
classification evals. They should cover exact alias matches, safe non-exact
local matches, ambiguous local candidates, missing local bottles, and cases that
require full classification. A local-identification eval must fail if the result
creates, repairs, searches the web, or matches an ambiguous candidate.

Production-miss evals must preserve the observed reference, URL, extracted
identity, current assignment, local candidates, and failed outcome. Verify the
real bottle online before encoding the expected Peated DB result. Attach
`provenance.source = "production_miss"`, `verifiedSourceUrls`, and `dbOutcome`.
Do not turn a production miss into a generalized pretend case.

Live eval replay JSON under
`packages/bottle-classifier/.vitest-evals/recordings/` is eval evidence, not a
local cache. Commit only intentional replay changes.

## Ownership

Keep responsibilities narrow:

- `classifierRuntime.ts`: extraction, retrieval, tools, agent loop
- `runtime/deterministic.ts`: pre-agent deterministic resolver registry
- `reviewPolicy.ts`: validation, normalization, invalid-state rejection, and
  confidence caps
- `exactCaskPolicy.ts`: generic exact-cask signal validation for reviewed scope
- `instructions.ts`: stable classifier and extractor prompts
- `priceMatchingEvidence.ts`: pure evidence checks shared with price matching
- `smws.ts`: SMWS parsing and exact-code behavior
- `apps/server/src/agents/bottleClassifier/service.ts`: server adapter wiring

`classifyBottleReference` means the full reviewed pipeline.
`identifyExistingBottleReference` means a proposed match-only local
identification pipeline.
`runBottleClassifierAgent` means only the raw LLM/tool pass.
