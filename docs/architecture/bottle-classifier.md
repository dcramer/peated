# Bottle Classifier

This spec defines the reviewed boundary for turning a raw bottle reference into a
Peated bottle identity decision. Price matching, review ingestion, repair tools,
and other consumers should use this result instead of redoing identity reasoning.

## Contract

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
`create_release`, `create_bottle_and_release`, and `no_match`.

The classifier is bottle-centric. Price-match terms such as `match_existing`,
`correction`, and `create_new` are downstream proposal policy, not classifier
policy.

## Correctness Bar

The classifier should choose the safest Peated DB outcome for the observed
reference.

- Match an existing candidate only when it covers the marketed identity without
  unsupported extra traits.
- Create a bottle or release only when reliable external evidence supports the
  missing canonical identity, unless a closed-form deterministic resolver
  applies.
- Repair only when the existing bottle identity is right but stored canonical
  fields conflict with evidence.
- Return `no_match` when evidence is missing, weak, contradictory, or not yet
  mappable to the local database.

False positive existing-bottle matches are worse than `no_match` or reviewed
creation.

## Execution

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
10. Downgrade unsupported or impossible decisions.

Downstream code may gate persistence and automation. It should not promote a
semantic identity decision the classifier did not make.

## Determinism

Deterministic code is allowed for closed-form behavior:

- schema validation
- normalization
- known-id validation
- impossible-state blocking
- confidence caps and automation gates
- exact identity anchors such as SMWS bottle codes

Deterministic code is not allowed for whisky-family semantics. Brand prefixes,
years, batch-like tokens, `single cask`, `barrel`, producer names, domain names,
and retailer wording are not enough to choose bottle versus release scope or to
create canonical identity.

If behavior depends on brand context, marketed family meaning, source quality,
or whether a fact is canonical versus observational, it belongs to the agent and
review policy.

## Agent Judgment

Use the agent for:

- source interpretation and reliability
- bottle versus release placement
- source fact versus canonical identity
- over-specific candidate detection
- supportive, weak, conflicting, or unnecessary web-evidence judgment

The agent must fill `identityBasis` and `confidenceBasis` for reviewed
decisions. `confidenceBasis.webEvidence = supportive` is required before
automation can treat web-backed create evidence as validated.

## Evidence And Tools

Source pages, snippets, search results, and retailer titles are evidence, not
policy.

The classifier does not maintain producer, critic, database, or retailer domain
allowlists. The agent judges source quality from content, independence,
specificity, and corroboration. Code may separate the originating listing from
other web results; it must not infer truth from a hardcoded domain class.

The originating retailer can support extraction, but it is not decisive creation
evidence by itself.

The agent has four read-only tools:

- `search_bottles`: local Peated bottle and release candidates
- `search_entities`: local Peated brand, distillery, and bottler entities
- `openai_web_search`: primary live web evidence search
- `brave_web_search`: optional second web index for sparse or weak results

Tool descriptions should state what the tool searches, what arguments mean, what
it returns, and any hard limits. Put classifier policy in the stable prompt or
review policy, not in tool prose.

Add source-specific tools only when they return materially better structured
evidence than general web search and preserve the same trust boundary.

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
- `reviewPolicy.ts`: validation, normalization, and downgrades
- `exactCaskPolicy.ts`: generic exact-cask signal validation for reviewed scope
- `instructions.ts`: stable classifier and extractor prompts
- `priceMatchingEvidence.ts`: pure evidence checks shared with price matching
- `smws.ts`: SMWS parsing and exact-code behavior
- `apps/server/src/agents/bottleClassifier/service.ts`: server adapter wiring

`classifyBottleReference` means the full reviewed pipeline.
`runBottleClassifierAgent` means only the raw LLM/tool pass.
