# Bottle Classifier

This spec defines the reviewed boundaries for turning a raw bottle reference
into Peated bottle identity evidence or a Peated DB outcome. Price matching,
review ingestion, repair tools, and other consumers should use these boundaries
instead of redoing identity reasoning.

## Contract

The package has four distinct contracts:

- `extractBottleReferenceIdentity(...)`: reads bottle identity facts from image
  or text. It does not decide whether the facts are canonical Peated identity.
- `identifyExistingBottleReference(...)`: proposed match-only local
  identification. It can return only `match` or `no_match`, must use local
  Peated candidates, and must not create, repair, or infer missing canonical
  identity.
- `classifyBottleReference(...)`: full reviewed classification. It can match,
  create, repair, or decline after considering local candidates, entity
  resolution, and web evidence when required.
- `auditBottle(...)`: checks one existing Bottle and returns a summary,
  proposed operations, and non-executable findings. It does not return another
  identity decision.

`classifyBottleReference(...)` accepts a generic reference:

- `name`
- optional `url` and `imageUrl`
- optional current Bottle id
- optional trace metadata
- optional seeded extracted identity or candidates for closed review flows

It returns either `ignored` with a reason, or `classified` with:

- a reviewed decision
- `extractedIdentity`
- local candidates used for reasoning
- web/search evidence used for reasoning
- resolved brand, bottler, and distillery entities

Decision actions are `match`, `repair_bottle`, `create_bottle`, and `no_match`.
`create_bottle` proposes one complete observed marketed Bottle: a stable
expression in `proposedBottle.name` plus required exact fields, including edition,
vintage year, release year, exact age, ABV, and cask flags. Canonical
downstream materialization combines those values without duplicating exact
markers in the stable name, creates the independently correct Bottle, and
manages grouping automatically. The classifier never selects a BottleGroup.

`caskType`, `caskSize`, and `caskFill` are soft-deprecated classifier metadata.
Schemas, stored context, replay data, and explicit supplied values remain
compatible. Once candidates are retrieved, the classifier does not use them as
explicit identity constraints or deterministic score adjustments and does not
investigate, reject, create, repair, or gate automation solely on those three
fields.
Marketed finish wording in the Bottle name or edition, exact cask or barrel
codes, `singleCask`, and `caskStrength` remain identity evidence.

`bottler` is the market-facing bottler or release imprint named for the product.
One Entity may be both Brand and bottler, or both distiller and bottler; a
separate imprint is not required. Ownership, importing, distribution, physical
packing, or page hosting alone does not establish the role. Otherwise the
classifier leaves it null and does not treat the missing value as a generic
enrichment gap.

During an audit, do not remove a populated bottler because the same Entity fills
another role or because a source omits it. Remove it only when product evidence
shows the assignment is wrong. Likewise, change a populated exact field only
with evidence for the same Bottle. Values from other batches or releases show
variation, not a correction.

The classifier is bottle-centric. Price-match terms such as `match_existing`,
`correction`, and `create_new` are downstream proposal policy, not classifier
policy.

## Bottle Checks

A Bottle check is persisted workflow state for a server-owned intent:

- `resolve_reference` identifies a Bottle from a listing or other external
  reference. Its existing structured decision remains the authoritative result.
  Photo identification persists this state only when an existing-Bottle match
  or repair result also contains supplemental operations or findings; the
  end-user flow still receives only its existing match/create response.
  Actionable store-price checks enter the Audits inbox only after the
  linked primary listing decision is complete.
- `audit_bottle` reviews an existing Bottle from a moderator request or a
  post-user-creation job. Its result is a narrative summary, proposed
  operations, and findings; it has no redundant structured conclusion.

A proposed operation is an agent suggestion with a typed input, rationale, and
evidence references. V1 supports exactly four:

- `update_bottle`
- `merge_bottles`
- `update_entity`
- `merge_entities`

The agent has bounded read-only Bottle, BottleGroup, Entity, local-search, and
focused web-evidence tools. It cannot mutate the catalog. Proposals may refer
only to inspected resources and collected evidence. Unsupported or unresolved
work remains a finding instead of becoming an invented operation, but only when
positive evidence establishes a real catalog defect that remains after proposed
operations apply. Uncertainty about whether an underspecified, generic, or
family row is intentional is not a finding; no operations and no findings is a
valid reviewed result.

The server prepares each proposal independently as a review operation. A review
operation adds the live diff, bounded impact, warnings, state token, and either
`pending_review` or a mechanical blocking reason. One blocked proposal does not
hide valid siblings, and operations are independent rather than an ordered
plan.

An `update_bottle` cannot target a Bottle that is also a `merge_bottles` source
in the same batch. The merge retires the source and subsumes correction of that
row; proposing both would be redundant and dependent.

Proposed catalog operations always require explicit moderator approval.
This remains true for a high-confidence result and for checks created after an
end-user save. Only the existing add-Bottle classification may
auto-apply under its established policy. Approval locks and revalidates the
operation; relevant drift makes it stale. Only failed operations may be
retried, using the same operation id and reconciliation before redispatch.
Blocked or stale work needs manual correction or a new check. A closed check is
immutable.

Moderators may remove an entire operation with a structured rejection reason.
For `update_bottle` and `update_entity`, they may also strike out direct patch
fields before approval. The original classifier proposal remains immutable for
audit history, while the operation records the excluded field paths and
executes only the remaining patch after the original state token is
revalidated. At least one field must remain. Merge operations are all-or-nothing
and cannot exclude fields.

Bottle checks are normal moderator functionality. A manual clean audit returns
its summary directly without persisting a check and removes older terminal
manual reviews. An actionable manual audit persists one current review, and
another request reuses that review until its work is terminal. A replacement
also removes older terminal manual reviews; pending, applying, blocked, stale,
and failed work remains durable.

Post-user-creation audits run after the Bottle save commits and never delay or
roll back that save. The job audits every eligible `manual_entry` and
`price_match_automation` Bottle. Background checks retain their event-key
receipt for retry safety.

### BottleGroup Findings

V1 has no BottleGroup operation. A suspected grouping problem is a
`bottle_group` finding unless an exact duplicate can be resolved by
`merge_bottles`.

The reviewed Laphroaig Càirdeas 2022 production miss demonstrates that
boundary: merge malformed Bottle `39096` into Warehouse 1 Bottle `45146`, while
leaving generic Bottle `44288` unchanged. It does not justify regrouping. The
audit corpus includes synthetic clean/no-op coverage and production-derived
Bottle update and duplicate-merge cases. It has no BottleGroup-finding case and
is not evidence for a group mutation.

Track real moderator-reviewed `bottle_group` findings before designing a
follow-up. If they demonstrate a recurring need, propose only the smallest
required regroup or group-merge operation. That separate change must preserve
Bottle ids, all Bottle consumers and aliases, shared-field rematerialization,
representatives, aggregates, and auditable before/after history. It must not add
move, merge, and split operations merely for symmetry.

### Measurement

Keep reference-decision accuracy and diagnostic cleanup recall separate from
audit operation and finding precision. Measure:

- intent accuracy and schema-valid output;
- authoritative reference-decision and canonical/collected grounding gates;
- exact proposed operation and finding sets, with missing and extra reference
  entries reported diagnostically and exact audit repair gating;
- reviewer rejection/correction and time to disposition;
- stale, failed, retry, and reconciliation outcomes;
- model cost, latency, and tool calls.

Intent is selected by the server entrypoint, not inferred by the model.
“Intent accuracy” therefore means that eval fixtures exercise the intended
entrypoint and durable checks retain that intent; it is not a second classifier
score.

Classifier evals provide the offline decision, operation, finding, cost,
latency, and tool-use measures. Durable check and operation timestamps,
statuses, and structured reasons provide the review and execution inputs.
These measurements guide classifier and review-workflow improvements; a schema
existing in the database is not itself a quality measurement.

Run `pnpm cli classifier rollout-report --days 30` for the durable rollout
inputs. The report counts accepted and rejected proposals separately and labels
`wrong_target`, `wrong_change`, and `insufficient_evidence` as quality
rejections; it does not claim that a rejected proposal was corrected. Counts are
broken down by check intent, origin, and operation type. Review time runs from
check completion to operation review. Stale and failure rates use all operations
that reached approval or execution as their denominator; blocked, pending, and
rejected proposals are not execution attempts. The report includes measurement
coverage, and malformed persisted telemetry fails reporting instead of being
treated as zero.

Audit agent runs persist agent-loop request/token usage, cache-token detail when
the provider supplies it, agent latency, and tool-call counts in `modelMetadata`.
Cache coverage is reported separately so missing provider detail is not treated
as a cache miss. Agent-loop token usage plus the stored model is the durable cost
input; extraction usage is outside that measurement. Live
evals estimate agent-loop cost from a dated standard, short-context pricing
table and label unsupported models, unavailable usage, and missing cache detail
explicitly. Separate web-search response tokens and tool fees, alternate
service tiers, long-context pricing, and regional adjustments remain outside
the estimate. The durable report still does not invent a dollar estimate when
no versioned pricing source was recorded. Reference-resolution runtime coverage
and durable dollar cost remain explicit measurement gaps.

## Correctness Bar

The classifier should first identify the observed Bottle's stable marketed
expression and exact structured fields, then choose the safest Peated DB outcome
for that complete Bottle.

- Treat local Peated search as prior-art evidence: it answers whether the exact
  target already exists and shows nearby modeling patterns. Nearby local rows
  must not erase clear source identity.
- Match an existing candidate only when it covers the complete identified Bottle
  without conflicting source-stated identity traits.
- Create a Bottle only when reviewed source, label, image,
  local-catalog, or web evidence supports the missing canonical identity.
  Automatic verification of creation requires corroborating evidence or a
  closed-form deterministic anchor.
- Repair and enrichment are secondary to identity routing. Missing optional
  fields, questionable catalog metadata, or non-target-defining repair
  opportunities should be recorded as observations or downstream repair work;
  they should not block a clear match or create outcome.
- Use repair actions only when a stored field conflict makes the selected target
  identity unsafe.
- Return `no_match` only when the Bottle identity is unresolved or when
  creating would invent an ambiguous hybrid.

False positive existing-bottle matches are worse than `no_match` or reviewed
creation.

Existing-bottle identification and full canonical classification have different
evidence bars:

- Local identification may stop at an existing match when local evidence is
  sufficient for the requested workflow. It must return `no_match` when the
  local evidence is ambiguous, incomplete, or requires canonical interpretation.
- Full classification is required when the caller wants a create, repair, or
  other canonical DB outcome.
- Web evidence is not required for every existing local match. It is one way to
  corroborate missing canonical identity, but complete-Bottle creation may also
  be supported by reviewed label/image evidence, closed-form deterministic
  anchors, or explicit local sibling evidence where policy allows it.
- Local sibling evidence comes only from explicit BottleGroup membership.
  Catalog adapters must not infer sibling relationships from Bottle names.
- Manual-search consumers should treat `no_match` as unresolved identity, not as
  a generic fallback for clear identities that happen to expose catalog repair
  or enrichment work.

## Execution

### Full Classification

The pipeline is:

1. Extract structured identity from image or text.
2. Ignore obvious non-whisky and non-single-bottle rows.
3. Retrieve local Bottle candidates.
4. Run deterministic resolvers before the agent. Today this is limited to SMWS
   code references.
5. Resolve local brand, bottler, and distillery entities.
6. Run one bounded classifier agent loop with local search, Entity search,
   focused web search, context tools, and four non-mutating proposal tools.
   The agent decides when web evidence is needed; the runtime does not search
   before the agent or delegate web interpretation to another model.
   Deterministic resolution, such as an SMWS code, is supplied as an identity
   anchor rather than bypassing the agent.
7. The reference agent returns the strict authoritative decision and findings.
   Successful proposal-tool calls are collected by runtime and attached as
   `proposedOperations`; the model does not echo operations in final output.
8. Validate and finalize the decision, then hand each collected proposal to
   server preparation independently. A proposal tool accepts work only when its
   payload is canonical, its existing targets were inspected, its evidence was
   collected, it is not an exact duplicate, and the per-run ceiling is not
   exceeded. The tools never mutate, approve, order, replace, or withdraw work.

With `candidateExpansion: initial_only`, full classification omits Bottle,
Entity, and web search but retains Bottle and Entity context tools for ids the
agent already knows. Local match-only identification receives neither context
nor proposal tools.

Existing-Bottle audits reuse the full reference evidence preparation: public
label extraction, initial Bottle candidates, Entity resolution, deterministic
identity anchors, the focused-web budget, and the same read/proposal tools. The
audited Bottle and its complete context are preloaded, then one bounded audit
agent loop compares the authoritative marketed identity with the stored Bottle.
Its strict final output remains only a summary and findings, without a redundant
reference decision.

Ignored references do not run the agent. Local match-only identification stays
separate and does not receive catalog proposal tools.

Downstream code may gate persistence and automation. It should not promote a
semantic identity decision the classifier did not make.

### Local Identification

The proposed match-only local identification pipeline is:

1. Accept already-extracted identity and image/text evidence.
2. Retrieve local Bottle candidates.
3. Return a strict deterministic match only for an unambiguous literal stored
   alias or other closed-form local id assertion.
4. Otherwise run a local-identification agent with local bottle search tools
   only.
5. Return `match` only when an existing Bottle safely covers the
   marketed identity; otherwise return `no_match`.

Local identification must not use web search, create or repair Bottles, or
normalize a missing Bottle into existence.
If the caller needs those outcomes, it should fall through to full
classification.

## Determinism

Deterministic code is allowed for closed-form behavior:

- schema validation
- normalization
- known-id validation
- impossible-state blocking
- the code-derived automation tier (`deriveAutomationTier`), which routes an
  automated decision to review or auto from action risk plus structured evidence
- exact identity anchors such as SMWS bottle codes
- unambiguous literal stored alias lookup for match-only local identification
- direct field contradictions, such as an extracted brand, category, distillery,
  stated age, ABV, vintage year, release year, cask-strength or single-cask
  flag, expression, or edition
  that conflicts with the matched local candidate

Deterministic code is not allowed for whisky-family semantics. Brand prefixes,
years, batch-like tokens, `single cask`, `barrel`, producer names, domain names,
retailer wording, vector similarity, text-search rank, fuzzy aliases, and
comparable-name matches are not enough to choose stable-versus-exact field
placement, create canonical identity, assign a BottleGroup, or bypass agent
judgment.

Post-agent deterministic review must not turn a classifier `match` into
`no_match` merely because code cannot prove the match from local text, fuzzy
name comparison, search rank, or structured-support heuristics. Missing
deterministic support can route the decision to review through the derived
automation tier, but only binary invalid state or direct extracted-field
conflict may erase the agent's semantic match.

A literal stored alias shortcut is allowed only when the normalized input
matches a non-ignored stored alias attached to exactly one Bottle. If there are
multiple targets, fuzzy/comparable-only matches, or any required whisky
interpretation, fall through to the agent.

If behavior depends on brand context, marketed family meaning, source quality,
or whether a fact is canonical versus observational, it belongs to the agent and
review policy.

### SMWS Deterministic Exception

SMWS is the narrow whisky-domain exception because its cask-code syntax is a
closed identifier scheme, not a fuzzy product-name heuristic.

Deterministic SMWS code may:

- recognize SMWS identity anchors such as `SMWS` and `The Scotch Malt Whisky
Society`
- parse exact-cask codes such as `95.71`, `RW6.5`, or `G15.1`
- compose the exact-cask code from separately labeled components when the SMWS
  identity is anchored and BOTH a distillery-number component (`Society
Distillery No. 1` / `Distillery No. 1`) and a cask-number component (`Single
Cask No. 285` / `Cask No. 285`) are present, for example composing `1.285`
  from a replica/anniversary label that never prints the composed code. This is
  a closed identifier operation in the same spirit as parsing `95.71`; the
  composed code is then treated exactly like a parsed code. Never compose from a
  single component and never invent the missing component.
- treat that exact code as the bottle identity anchor for matching existing
  SMWS rows
- derive the rough distillery/category from the curated SMWS code table when the
  code prefix is present
- carry a visible or extracted subtitle into the create proposal display name,
  for example `95.71 Prepare for Winter`, while keeping the code as the match
  anchor

Deterministic SMWS code must not:

- invent or correct the subtitle/title
- decide between competing subtitles when source evidence is ambiguous
- generalize SMWS cask-code behavior to non-SMWS single-cask, barrel, batch, or
  private-selection labels
- use brand-prefix, retailer-title, or fuzzy-name similarity to prove a match
- assign a BottleGroup or remove exact Bottle fields solely because a cask code,
  subtitle, age, ABV, or year appears on the label

Outside this exception, single-cask and bottling identity remains model-led and
evidence-reviewed. Code may preserve exact observations and block impossible
states, but it must not decide canonical whisky-family semantics from string
patterns alone.

### Review Policy Audit

`reviewPolicy.ts` is a final safety gate, not a second classifier. Audit changes
there against this boundary:

- Keep schema normalization, unknown-id rejection, impossible-state rejection,
  and non-whisky rejection.
- Keep checks that validate the selected target exists in the reviewed candidate
  set.
- Keep direct extracted-field conflict rejection only for explicit conflicts on
  populated fields.
- Do not reintroduce numeric-confidence or confidence-band reconciliation caps.
  The classifier contract carries no numeric `confidence` and no
  `confidenceBasis.band`; automated flows derive review routing in code from the
  structured evidence via `deriveAutomationTier`, and the model's veto is a typed
  `unresolvedRisks` entry (category plus note) that only forces review.
- Remove or narrow checks that re-score names, infer family modeling, require
  local text-rank proof, or turn a clear agent match/create into `no_match`
  because the catalog row is incomplete or has non-target-defining cleanup work.
- Keep review routing that treats lack of web corroboration as a downgrade in the
  derived tier only, never as an erasure of the agent's match; the source label,
  image evidence, local candidates, or a closed-form anchor can each be the
  auto-tier anchor instead of web evidence.
- Prefer adding an eval that proves the agent decision is right before relaxing
  a review-policy gate. Only relax the gate when the remaining failure is the
  gate itself.

## Agent Judgment

Use the agent for:

- source interpretation and reliability
- stable proposed expression versus structured exact-Bottle fields
- source fact versus canonical identity
- over-specific candidate detection
- supportive, weak, conflicting, or unnecessary web-evidence judgment
- match decisions that are not closed-form local id assertions

The full classifier agent must fill `identityBasis` and `confidenceBasis` for
reviewed decisions. The contract has no numeric confidence score and no
confidence band; the agent expresses certainty only through positive evidence,
typed `unresolvedRisks` (category plus note), `webEvidence`, and the action
itself. Any asserted unresolved risk forces automated review and no field can
upgrade a decision the derived tier routes to review.
`confidenceBasis.webEvidence = supportive` is required before automation can
treat web-backed create evidence as validated.

## Evidence And Tools

Source pages, snippets, search results, and retailer titles are evidence, not
policy.

The classifier does not maintain producer, critic, database, or retailer domain
allowlists. The agent judges source quality from content, independence,
specificity, and corroboration. Code may separate the originating listing from
other web results; it must not infer truth from a hardcoded domain class.

The originating retailer can support extraction, but it is not decisive creation
evidence by itself.

For image inputs, extraction scans the complete readable label, including
smaller secondary bands, subtitles, and neck tags, for identity-bearing edition,
batch, release, marketed finish, and variant text. Missing extraction remains
preferable to inventing text that is not visible. Explicit cask type, size, and
fill may be retained when readily available, but extraction does not need to
infer or investigate them.

The full classifier agent has read-only tools for local candidates, local
entities, and live web evidence:

- `search_bottles`: local Peated Bottle candidates
- `search_entities`: local Peated brand, distillery, and bottler entities
- `get_bottle_context`: bounded identity context for one inspected Bottle
- `get_entity_context`: bounded identity context for one inspected Entity
- `firecrawl_web_search`: one to three focused live searches in one agent turn,
  with ranked source URLs and compact relevance snippets without scraping every
  result page
- `firecrawl_read_page`: focused reading of one promising public page when a
  short search excerpt does not expose the identity-critical fact

When Firecrawl is not configured, the agent has no web-evidence tools. The runtime
does not silently replace it with a second model or another provider.

Tool descriptions should state the tool's purpose, arguments, result, hard
limits, and tool-specific preconditions. Keep cross-tool classifier policy in
the stable prompt or review policy rather than only in tool prose.

Add source-specific tools only when they return materially better structured
evidence than general web search and preserve the same trust boundary.

A local-identification agent should have a narrower tool set: local bottle
search, and entity search only when it materially improves matching. It should
not have web-search tools because it is not allowed to create, repair, or assert
new canonical identity.

## Identity Scope

`identityScope = product` is the default complete marketed Bottle identity.

Use `identityScope = exact_cask` only when the exact cask is the marketed bottle
identity. SMWS code references qualify because the code is the bottle identity
anchor. Generic cask or barrel wording does not qualify without reliable evidence
that the product is marketed as that exact single-cask identity.

Exact-cask identity remains one independently complete Bottle; BottleGroup
assignment is automatic downstream.

## Evals

Classifier evals should score final action, ids, create drafts, identity scope,
required exact-Bottle fields, and incorrect fields. There is no numeric confidence to
calibrate; instead evals assert the code-derived automation tier
(`expectedTier: auto | review`) computed deterministically from the decision by
`deriveAutomationTier`, and that derivation is covered by unit tests rather than
model-scored confidence. Encoded expected fields are required. Creation fixtures
do not encode `caskType`, `caskSize`, or `caskFill` as classifier requirements.
Missing unencoded optional enrichment can be tolerated; wrong required identity
fields should fail.
Reference and audit fixtures exercise the same single agent loop and four
proposal tools used by production Bottle checks. On a replay cache hit the eval
harness does not invoke the underlying web tool, so replay does not consume the
in-process web-query budget; live runs remain the budget authority.

For `resolve_reference`, the authoritative identity decision and
canonical/collected grounding are gating. Exact operation and finding sets,
including missing and extra entries, are reported by named informational judges;
a fixture cannot prove that an otherwise supported proposal is harmful merely by
omitting it. This does not turn opportunistic cleanup into a requirement for
every reference, and every proposal still requires moderator approval before
mutation. For `audit_bottle`, exact operations, findings, and required evidence
are gating because active repair investigation is the intent.

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
- `reviewPolicy.ts`: validation, normalization, and invalid-state rejection
- `exactCaskPolicy.ts`: generic exact-cask signal validation for reviewed scope
- `instructions.ts`: stable classifier and extractor prompts
- `priceMatchingEvidence.ts`: pure evidence checks and the code-derived
  automation tier (`deriveAutomationTier`) shared with price matching
- `smws.ts`: SMWS parsing and exact-code behavior
- `apps/server/src/agents/bottleClassifier/service.ts`: server adapter wiring

`classifyBottleReference` means the full reviewed pipeline.
`identifyExistingBottleReference` means a proposed match-only local
identification pipeline.
`runBottleClassifierAgent` means only the raw LLM/tool pass.
