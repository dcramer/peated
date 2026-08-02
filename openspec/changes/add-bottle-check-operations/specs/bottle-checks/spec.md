## ADDED Requirements

### Requirement: Public entrypoints select the Bottle-check intent

The Bottle classifier SHALL preserve `classifyBottleReference` for
`resolve_reference` and add `auditBottle` for `audit_bottle`. Both SHALL use the
same classifier capability where useful without requiring existing callers to
send a universal intent command.

#### Scenario: Resolve an external reference

- **WHEN** the caller invokes `classifyBottleReference`
- **THEN** it SHALL provide a Bottle reference with source metadata
- **AND** the classifier SHALL evaluate how that reference should resolve

#### Scenario: Audit an existing Bottle

- **WHEN** the caller invokes `auditBottle`
- **THEN** it SHALL provide one existing Bottle id, a structured origin, and
  an optional note
- **AND** the server SHALL load the Bottle, its group, related Entities, and
  bounded sibling context

#### Scenario: Audit routing is structured

- **WHEN** the caller starts an audit
- **THEN** `origin` SHALL be one of
  `moderator | post_user_creation`
- **AND** an optional note SHALL provide context only and SHALL NOT change
  routing or automation policy

### Requirement: Check results contain only necessary semantic structure

The classifier SHALL return the existing Bottle decision for
`resolve_reference`. An audit SHALL return a summary, proposed operations, and
findings without a separate outcome enum.

#### Scenario: Reference is classified

- **WHEN** a reference check completes with `status: "classified"`
- **THEN** its authoritative decision SHALL remain one of
  `match | create_bottle | repair_bottle | no_match`
- **AND** it MAY include independent supplemental operations
- **AND** omission of an otherwise useful supplemental operation SHALL NOT
  invalidate a correct reference decision

#### Scenario: Reference is ignored

- **WHEN** a reference is rejected as non-whisky or not a single Bottle
- **THEN** the classifier SHALL return the existing ignored result with empty
  proposed operations and findings
- **AND** it SHALL NOT run the semantic agent

#### Scenario: Reference uses one semantic loop

- **WHEN** a reference is not ignored
- **THEN** the classifier SHALL run exactly one bounded semantic agent loop
- **AND** that loop SHALL receive bounded read tools and all four non-mutating
  proposal tools
- **AND** its strict final output SHALL contain the authoritative decision and
  findings, but SHALL NOT contain proposed operations
- **AND** runtime SHALL attach successful tool-recorded proposals and collected
  artifacts to the result

#### Scenario: Reference agent fails

- **WHEN** the provider call fails or its raw final output violates the strict
  reference schema
- **THEN** the Bottle check SHALL fail without persistence or mutation
- **AND** it SHALL NOT make another semantic agent call or substitute a
  fallback result

#### Scenario: Existing Bottle is clean

- **WHEN** a fully supported audit finds no catalog change
- **THEN** `proposedOperations` SHALL be empty
- **AND** `findings` SHALL be empty

#### Scenario: Existing Bottle needs changes

- **WHEN** a fully supported audit finds catalog changes
- **THEN** it SHALL return the changes as typed proposed operations
- **AND** it MAY also return unresolved non-executable findings

#### Scenario: Existing Bottle cannot be assessed safely

- **WHEN** identity or catalog state remains materially ambiguous
- **THEN** the audit SHALL describe the unresolved issues as findings
- **AND** it SHALL NOT invent an executable operation for those issues

#### Scenario: UI labels an audit

- **WHEN** an audit result is displayed
- **THEN** the UI SHALL derive clean, changes-proposed, and needs-review labels
  from the presence of operations and findings
- **AND** the model SHALL NOT return a duplicate audit-outcome field

### Requirement: Findings preserve non-executable issues

Every check result SHALL include a `findings` array. Each finding SHALL contain
a bounded scope, summary, and at least one typed evidence reference, but SHALL
NOT be executable. Findings SHALL be concrete reviewer-relevant catalog
problems, not missing optional enrichment, harmless absence, or speculative
cleanup. A finding SHALL require positive evidence of a real catalog defect
that remains after all proposed operations apply. Mere uncertainty about
whether an underspecified, generic, or family row is intentional SHALL NOT be a
finding, and a reviewed check MAY validly return no operations and no findings.
A finding SHALL describe a separate unresolved issue and SHALL NOT
repeat a change or rationale already fully represented by a proposed operation.
A cross-group `merge_bottles` retires its source Bottle, so the source and
destination's prior group difference SHALL NOT also be a `bottle_group`
finding. A `bottle_group` finding SHALL describe a distinct problem that
remains among surviving Bottles.

#### Scenario: Supported and unsupported issues are found together

- **WHEN** a check finds one supported operation and another issue outside the
  supported operation set
- **THEN** it SHALL return the supported proposed operation
- **AND** it SHALL preserve the other issue as a finding

### Requirement: Proposed operations use one canonical bounded union

The Bottle-classifier contract SHALL contain one strict literal-tagged Zod
union for `proposedOperations`. Each proposal tool's provider schema SHALL be
generated from its corresponding variant with the operation `type` omitted.
Every raw tool payload SHALL be parsed immediately through the canonical Zod
contract after its tool overwrites any caller-supplied `type` with the tool's
fixed operation type. The runtime-attached array SHALL use a configurable
runaway-output safety ceiling rather than a small semantic operation limit.

Every proposal SHALL contain only `type`, typed `input`, `rationale`, and
at least one entry in `evidenceRefs`. Server-owned ids, status, permissions, previews,
state tokens, function names, and results SHALL NOT be accepted from proposal
tool payloads.

#### Scenario: Supplemental operations are valid

- **WHEN** every operation matches a recognized variant and intent policy
- **THEN** the server SHALL expose the parsed typed operations

#### Scenario: Supplemental operations are invalid for reference resolution

- **WHEN** a schema-valid reference result has one supplemental operation that
  cannot be prepared against current state
- **THEN** the server SHALL preserve the decision and every independently valid
  operation
- **AND** it SHALL retain the failed operation as blocked with a preparation
  reason

#### Scenario: Supplemental operations are invalid for audit

- **WHEN** a schema-valid audit contains an operation that cannot be prepared
- **THEN** the server SHALL retain the summary, findings, valid operations, and
  blocked operation

#### Scenario: Model output violates the schema

- **WHEN** final model output fails the strict intent-specific schema
- **THEN** the runtime SHALL fail the check without persisting malformed
  operation fragments

### Requirement: Proposed and review operation contracts are separate

The Bottle-classifier contract SHALL own one strict literal-tagged Zod union
for the four proposal variants. Server preparation and execution SHALL use
plain exhaustive `switch` functions over that inferred TypeScript
discriminated union. Review responses SHALL use an explicit
blocked-versus-prepared union. Its prepared branch SHALL use a
resource-discriminated union correlating proposal and preview, and SHALL NOT
expose internal prepared inputs.

#### Scenario: Prepare a model proposal

- **WHEN** a parsed proposed operation is supported
- **THEN** its prepare function SHALL normalize input, resolve evidence,
  calculate a live preview, and attach a server-owned state token
- **AND** downstream review SHALL consume only the review operation

#### Scenario: Preparation is blocked

- **WHEN** a parsed proposed operation cannot be prepared
- **THEN** its review operation SHALL contain the typed proposal and concrete
  preparation error
- **AND** it SHALL NOT invent a preview or state token

#### Scenario: Operation implementation stays TypeScript-native

- **WHEN** a developer adds an operation type
- **THEN** they SHALL add its Zod variant and exhaustive prepare/execute cases
- **AND** `assertNever` checks SHALL make missing cases compile errors
- **AND** the design SHALL NOT require handler classes, registries, mapped
  generic frameworks, inheritance, reflection, a dependency-injection
  container, or a generic command object

#### Scenario: Proposal is mechanically blocked

- **WHEN** an operation has an unknown id, impossible source/destination pair,
  unsupported role value, or direct conflicting write
- **THEN** preparation SHALL retain it as blocked with the exact mechanical
  reason
- **AND** it SHALL NOT infer that the proposed identity or evidence is wrong

#### Scenario: Model supplies server-owned fields

- **WHEN** a proposal includes status, permissions, preview, state token,
  function name, route, result, or database operation id
- **THEN** strict proposal validation SHALL reject it

### Requirement: Entity choices are explicit

Entity fields in an `update_bottle` operation's shared patch SHALL use
`{ kind: "existing", entityId }` or
`{ kind: "create", entity: ProposedEntityDraft }`.
The primary `create_bottle` decision SHALL retain its existing `{ id, name }`
Entity contract, including `id: null` for a new Entity.

#### Scenario: Use an existing Entity

- **WHEN** the classifier selects an existing Brand, distiller, or bottler
- **THEN** it SHALL provide the known Entity id
- **AND** that id SHALL exist in collected Entity evidence

#### Scenario: Create an Entity inside a Bottle update operation

- **WHEN** an `update_bottle` operation proposes a new related Entity
- **THEN** it SHALL provide an explicit creation draft without invented country
  or region ids
- **AND** preparation SHALL resolve exact location names, report possible
  collisions, and show Entity creation in the Bottle operation preview
- **AND** no standalone Entity-create operation SHALL be produced by a Bottle
  check

### Requirement: Initial Bottle operations are bounded

The operation union SHALL initially support `update_bottle` and
`merge_bottles`.

#### Scenario: Propose a Bottle update

- **WHEN** an operation is `update_bottle`
- **THEN** it SHALL name one existing Bottle and a non-empty sparse patch
  with explicit `shared` and `exact` sections
- **AND** the agent-facing patch SHALL expose canonical identity and
  relationship fields but not content, images, tags, statistics, or
  presentation data
- **AND** a Brand change SHALL use the shared patch rather than a separate
  reassignment operation
- **AND** preparation SHALL show all BottleGroup fan-out and related Entity
  creation as explicit preview effects

#### Scenario: Assign an existing BottleSeries

- **WHEN** an `update_bottle` shared patch assigns a non-null `seriesId`
- **THEN** an inspected Bottle context SHALL expose that exact BottleSeries id
- **AND** the proposal tool SHALL reject an uninspected BottleSeries target
- **AND** preparation SHALL revalidate that the BottleSeries exists and belongs
  to the selected Brand

#### Scenario: Propose an exact Bottle merge

- **WHEN** an operation is `merge_bottles`
- **THEN** it SHALL name one existing source Bottle to retire and one distinct
  existing destination Bottle to survive
- **AND** its rationale SHALL assert exact marketed-identity equivalence
- **AND** internally inconsistent shared or BottleGroup fields SHALL be treated
  as evidence rather than authority when direct product evidence coherently
  identifies the selected exact Bottle
- **AND** when direct authoritative external product evidence is available, the
  proposal SHALL cite it
- **AND** catalog agreement, an audit note, search rank, or an attached label
  image alone SHALL NOT establish equivalence
- **AND** when no authoritative source is available, equivalence SHALL NOT be
  inferred from catalog data alone
- **AND** once exact equivalence is established, conflicting shared or group
  fields SHALL NOT be treated as proof of a distinct release or a separate
  `bottle_group` finding
- **AND** no relative merge-direction field SHALL be accepted

### Requirement: Initial Entity operations are bounded

The operation union SHALL initially support `update_entity` and
`merge_entities` for Entities related to the checked Bottle. Standalone Entity
creation belongs to an Entity-focused workflow.

#### Scenario: Propose Entity update

- **WHEN** an operation is `update_entity`
- **THEN** it SHALL name one existing Entity and a non-empty patch limited
  initially to name, short name, roles, website, country, region, and year
  established
- **AND** it SHALL NOT expose description provenance, address, coordinates, or
  unrelated enrichment
- **AND** identity or location changes SHALL cite collected evidence for agent
  and moderator judgment

#### Scenario: Propose Entity merge

- **WHEN** an operation is `merge_entities`
- **THEN** it SHALL name one existing source Entity to retire and one distinct
  destination Entity to survive
- **AND** canonical execution SHALL preserve the union of supported Brand,
  distiller, and bottler roles

#### Scenario: Existing Entity target was not inspected

- **WHEN** an operation targets an existing Entity that was not loaded through
  classifier search or `get_entity_context`
- **THEN** the proposal tool SHALL reject the call and record no operation
- **AND** code SHALL NOT use relationship heuristics to decide whether the
  Entity is semantically relevant

#### Scenario: Entity cleanup is unrelated to the Bottle

- **WHEN** an Entity issue does not materially repair the checked Bottle, an
  exact duplicate of it, or an Entity directly representing it
- **THEN** the agent SHALL NOT propose that cleanup from the Bottle check
- **AND** prompt and eval policy SHALL enforce this scope without deterministic
  graph-distance, name-similarity, or search-rank gates

### Requirement: Proposed operations are independent

Every v1 operation SHALL be executable against existing state without another
proposed operation, and array order SHALL have no meaning.

#### Scenario: Operation references another operation result

- **WHEN** an operation targets an Entity or Bottle proposed for creation by
  another operation
- **THEN** validation SHALL reject the operation batch

#### Scenario: Reference repair is required

- **WHEN** a mutation is required before an incoming reference can resolve
  safely
- **THEN** it SHALL remain represented by the primary `create_bottle` or
  `repair_bottle` decision
- **AND** it SHALL NOT become a supplemental dependency

#### Scenario: Operations conflict

- **WHEN** operations duplicate one another, patch the same object
  incompatibly, or retire a selected match target
- **THEN** preparation SHALL block only the conflicting operations
- **AND** it SHALL preserve independent proposals

#### Scenario: A merge source also has an update

- **WHEN** a proposed `update_bottle` targets a Bottle that is the source of a
  `merge_bottles` operation in the same batch
- **THEN** the agent SHALL omit the update because the merge retires the source
  and subsumes correction of its row
- **AND** preparation SHALL treat both operations as directly conflicting if
  the model nevertheless returns them

#### Scenario: Merges share a source or destination

- **WHEN** two Bottle merges or two Entity merges in one batch share any source
  or destination id
- **THEN** preparation SHALL block both operations
- **AND** a valid shared-destination merge SHALL require a separate check
  prepared after the first merge completes

#### Scenario: An Entity update overlaps an Entity merge

- **WHEN** an `update_entity` targets an Entity that is the source of a
  `merge_entities` operation in the same batch
- **THEN** preparation SHALL block both operations because the source is
  retired
- **WHEN** an `update_entity` changes the merge destination's name, short name,
  or roles
- **THEN** preparation SHALL block both operations because Entity-merge
  execution consumes those identity fields
- **WHEN** an `update_entity` changes only the merge destination's website,
  country, region, or year established
- **THEN** both operations SHALL remain independently executable in either
  approval order
- **AND** the Entity-merge state token SHALL omit those destination metadata
  fields while retaining the destination identity and relationship state that
  execution consumes

### Requirement: Deterministic gates do not replace semantic judgment

The proposal collector SHALL enforce schema, inspected ids, collected evidence,
and supported enum values. Preparation SHALL enforce permissions, direct
payload contradictions, and operation-specific live state. Neither boundary
SHALL add semantic identity heuristics.

#### Scenario: Model proposes an identity-sensitive operation

- **WHEN** the classifier proposes a Bottle or Entity merge, creation, or role
  change with collected evidence
- **THEN** deterministic code SHALL NOT require text rank, name similarity,
  prefix matching, trusted-domain membership, or another classifier heuristic
  to agree
- **AND** semantic correctness SHALL remain subject to agent judgment and
  moderator approval

#### Scenario: Evidence reference is prepared

- **WHEN** an operation cites evidence collected during the run
- **THEN** the proposal collector SHALL verify that the reference exists before
  recording the operation
- **AND** it SHALL NOT infer evidence quality or relevance from the URL or
  source domain

### Requirement: Evidence references are typed

Evidence references SHALL use a literal-tagged union for a source field, Bottle
id, Entity id, or web-result URL. Freeform evidence-reference
strings SHALL NOT be accepted. Source fields SHALL use exact serialized input
paths: `reference.<field>`, `extractedIdentity.<field>`,
`imageEvidence.fieldCandidates.<field>`, or `audit.note`.

#### Scenario: Model cites a web result

- **WHEN** a proposal or finding cites web evidence
- **THEN** it SHALL provide the exact result URL
- **AND** preparation SHALL verify that URL exists in web artifacts from the
  same check

#### Scenario: Runtime attaches artifacts

- **WHEN** the model returns valid output
- **THEN** runtime code SHALL attach collected artifacts and model metadata,
  including structured results from `get_bottle_context` and
  `get_entity_context`
- **AND** the model SHALL NOT echo or author those server-owned fields
- **AND** the runtime SHALL attach proposals recorded by successful proposal
  tool calls during that same run

#### Scenario: Runtime records reference model metadata

- **WHEN** the semantic model loop runs for a reference check
- **THEN** the runtime SHALL record its duration, request and token usage, and
  tool-call measurements in the existing model metadata field
- **AND** the existing `classifyBottleReference` result contract SHALL remain
  unchanged
- **AND** extraction and standalone preload web-search cost SHALL NOT be folded
  into semantic-agent metadata
- **AND** an override-only run with no native semantic call SHALL report null
  model metadata

### Requirement: Full checks expose one fixed proposal-tool set

Every full reference and audit check SHALL expose the same four non-mutating
proposal tools. Local match-only identification SHALL remain separate and SHALL
not expose them.

#### Scenario: Full Bottle check runs

- **WHEN** the semantic agent runs a full reference or audit check
- **THEN** it SHALL receive `propose_update_bottle`,
  `propose_merge_bottles`, `propose_update_entity`, and
  `propose_merge_entities`
- **AND** the server SHALL NOT expose a partial per-operation capability map
- **AND** rollout flags SHALL NOT change this proposal-tool set

#### Scenario: Closed candidate expansion still permits target inspection

- **WHEN** a full reference check uses `candidateExpansion: initial_only`
- **THEN** it SHALL withhold Bottle, Entity, and web search tools
- **AND** it SHALL retain Bottle and Entity context tools for inspecting known
  ids before recording proposals
- **AND** local match-only identification SHALL receive neither context nor
  proposal tools

#### Scenario: Proposal tool records valid work

- **WHEN** a proposal-tool payload passes its canonical schema and grounding
  checks
- **THEN** runtime SHALL record the typed proposal for moderator review
- **AND** the tool SHALL NOT mutate, approve, dispatch, or apply catalog data

#### Scenario: Proposed operation is not grounded

- **WHEN** a structurally valid proposed operation targets an uninspected record
  or cites evidence that was not collected
- **THEN** the classifier result and other valid operations SHALL remain intact
- **AND** the proposal tool SHALL reject the call, record no operation, and
  return the concrete grounding error to the agent

### Requirement: Bottle checks are read-only and bounded

The classifier agent SHALL use only bounded read-only Bottle, BottleGroup,
Entity, and web-evidence tools. Consumer counts and mutation blast radius SHALL
remain server-owned review-preview data.

Bottle context SHALL include bounded identity evidence already attached to the
record: Bottle observations, canonical images, and identity-bearing public
activity images. It SHALL exclude user identity, private activity, tasting
prose, consumer counts, and unrelated social data.

#### Scenario: Agent checks related catalog state

- **WHEN** a Bottle exposes suspicious Bottle or Entity data
- **THEN** the agent MAY load related records and focused evidence
- **AND** it SHALL NOT receive mutation, approval, queue, or generic database
  tools

#### Scenario: Canonical Bottle fields are malformed

- **WHEN** attached observations or public label images may identify the
  Bottle more reliably than its canonical fields
- **THEN** `get_bottle_context` SHALL return a bounded evidence sample with
  source and URL metadata
- **AND** selected images SHALL pass through the existing classifier
  image-evidence extractor so the context contains normalized label evidence,
  not an opaque URL alone
- **AND** image extraction SHALL scan the complete readable label, including
  smaller secondary bands, subtitles, and neck tags, for identity-bearing
  edition, batch, release, finish, and variant text
- **AND** the runtime SHALL preserve that sample in the check artifacts
- **AND** no private user or unrelated activity data SHALL be exposed

#### Scenario: Agent gathers more evidence

- **WHEN** a tool result exposes useful new evidence
- **THEN** the current semantic loop MAY continue gathering evidence
- **AND** it SHALL stop on valid output, the existing turn limit, the shared
  web-query budget, or terminal provider failure

#### Scenario: Reference final output owns identity

- **WHEN** the reference semantic loop completes
- **THEN** its provider schema SHALL contain the canonical decision fields and
  findings
- **AND** it SHALL use provider strict mode and canonical Zod parsing
- **AND** its decision SHALL be the authoritative result after canonical
  finalization
- **AND** it SHALL NOT contain proposed operations or intermediate conclusions

#### Scenario: Proposal collector attaches independent work

- **WHEN** a proposal tool is called during the same semantic loop
- **THEN** the collector SHALL parse the canonical typed payload
- **AND** it SHALL require inspected existing targets and collected evidence
- **AND** every existing Bottle and Entity target SHALL appear in the
  proposal's typed evidence references
- **AND** repeating an exact type/input pair SHALL revalidate and replace that
  proposal's rationale and evidence in place
- **AND** the collector SHALL enforce the bounded unique-proposal ceiling
- **AND** a rejected call SHALL record no proposal and SHALL explain the
  rejection to the agent
- **AND** runtime SHALL attach accepted proposals without changing the
  authoritative decision

#### Scenario: Retrieved content contains instructions

- **WHEN** source text, a page, or a tool result contains instructions
- **THEN** the runtime and prompt SHALL treat that content only as untrusted
  evidence
- **AND** it SHALL NOT change intent, permissions, operation availability, or
  approval policy

### Requirement: Authoritative decisions settle before operation preparation

The existing review policy SHALL finalize the authoritative reference decision
before operations are checked for direct conflicts.

#### Scenario: End-user primary action applies automatically

- **WHEN** the end-user add-Bottle workflow automatically applies a primary
  create or repair
- **THEN** supplemental operations SHALL be prepared only after that mutation
  commits

#### Scenario: Reviewed primary action changes later

- **WHEN** a reviewed workflow changes catalog state after supplemental
  proposals were first prepared
- **THEN** preview and approval SHALL prepare those operations again against
  current state

#### Scenario: Reviewed primary action is still open

- **WHEN** the exact store-price attempt linked to a reference check does not
  have an `approved` or `ignored` final status
- **THEN** supplemental operations MAY be previewed
- **AND** they SHALL NOT be applied until the primary workflow is terminal

#### Scenario: A newer store-price attempt exists

- **WHEN** a forced rerun creates a newer attempt and check for the same mutable
  proposal
- **THEN** the older check SHALL continue to use its own linked attempt as its
  terminal authority

#### Scenario: The exact primary attempt cannot be verified

- **WHEN** a persisted reference check's attempt link was cleared or the linked
  attempt no longer matches the check's proposal and price
- **THEN** supplemental operations MAY be previewed
- **AND** execution SHALL fail closed

### Requirement: Evals score intent and operations explicitly

Classifier evals SHALL hard-gate the existing reference decision and
canonical/collected grounding. They SHALL score exact proposed operation and
finding sets without assigning the same completion contract to both intents.

#### Scenario: Evaluate reference resolution

- **WHEN** a `resolve_reference` fixture runs
- **THEN** existing decision assertions SHALL remain in force
- **AND** canonical schema, inspected-target, and collected-evidence grounding
  assertions SHALL remain in force
- **AND** exact expected operation and finding sets, including missing and
  extra entries, SHALL remain visible as named diagnostic scores without
  failing an otherwise correct and grounded resolution
- **AND** the eval SHALL NOT classify a supported proposal as harmful solely
  because the fixture did not enumerate it

#### Scenario: Evaluate an existing-Bottle audit

- **WHEN** an `audit_bottle` fixture runs
- **THEN** the eval SHALL score exact operations and findings
- **AND** missing supported operations or required evidence SHALL fail the eval
- **AND** a clean fixture SHALL require both arrays to be empty

#### Scenario: Preserve a production miss

- **WHEN** a production case becomes an eval
- **THEN** it SHALL retain the real intent, subject, catalog artifacts,
  verified evidence, expected result, and exact operations
- **AND** reference operation-set mismatches SHALL remain diagnostic while
  audit operation-set mismatches SHALL follow the audit's exact-repair gate

#### Scenario: Keep the initial audit corpus evidence-honest

- **WHEN** the initial semantic audit corpus is assembled
- **THEN** it SHALL contain a synthetic clean/no-op case and the verified
  Laphroaig Càirdeas production case represented as both its observed reference
  miss and a clearly labeled derived audit variant
- **AND** the derived audit SHALL NOT claim to be a second observed production
  failure
- **AND** operation-shape breadth, invalid combinations, grounding failures,
  and cross-operation conflicts SHALL be covered by deterministic contract,
  policy, and server integration tests rather than invented semantic repair
  fixtures
