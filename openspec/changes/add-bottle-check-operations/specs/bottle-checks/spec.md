## ADDED Requirements

### Requirement: Public entrypoints select the Bottle-check intent

The Bottle classifier SHALL preserve `classifyBottleReference` for
`resolve_reference` and add `auditBottle` for `audit_bottle`. Both SHALL share
the same internal agent where useful without requiring existing callers to send
a universal intent command.

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

- **WHEN** a reference check completes
- **THEN** its primary result SHALL remain one of
  `match | create_bottle | repair_bottle | no_match`
- **AND** it MAY include independent supplemental operations

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
cleanup.

#### Scenario: Supported and unsupported issues are found together

- **WHEN** a check finds one supported operation and another issue outside the
  enabled operation set
- **THEN** it SHALL return the supported proposed operation
- **AND** it SHALL preserve the other issue as a finding

### Requirement: Proposed operations use one strict bounded union

The model-output schema SHALL contain one strict Zod discriminated union for
`proposedOperations`. The array SHALL use a configurable runaway-output safety
ceiling rather than a small semantic operation limit.

Every proposal SHALL contain only `type`, typed `input`, `rationale`, and
at least one entry in `evidenceRefs`. Server-owned ids, status, permissions, previews,
state tokens, function names, and results SHALL NOT be accepted from model
output.

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
- **THEN** the runtime MAY perform one bounded structured-output retry
- **AND** exhaustion SHALL fail the check without persisting malformed
  operation fragments

### Requirement: Proposed and review operation contracts are separate

The Bottle-classifier contract SHALL own one strict Zod discriminated union for
the four proposal variants. Server preparation and execution SHALL use plain
exhaustive `switch` functions over that inferred union. Review responses SHALL
use an explicit blocked-versus-prepared union. Its prepared branch SHALL use a
resource-discriminated union correlating proposal and preview, and SHALL NOT
expose internal prepared inputs.

#### Scenario: Prepare a model proposal

- **WHEN** a parsed proposed operation is supported and enabled
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
  unsupported role value, direct conflicting write, or disabled deployment
  capability
- **THEN** preparation SHALL retain it as blocked with the exact mechanical
  reason
- **AND** it SHALL NOT infer that the proposed identity or evidence is wrong

#### Scenario: Model supplies server-owned fields

- **WHEN** a proposal includes status, permissions, preview, state token,
  function name, route, result, or database operation id
- **THEN** strict proposal validation SHALL reject it

### Requirement: Entity choices are explicit

Entity fields in Bottle creation and shared Bottle updates SHALL use
`{ kind: "existing", entityId }` or
`{ kind: "create", entity: ProposedEntityDraft }`.

#### Scenario: Use an existing Entity

- **WHEN** the classifier selects an existing Brand, distiller, or bottler
- **THEN** it SHALL provide the known Entity id
- **AND** that id SHALL exist in collected Entity evidence

#### Scenario: Create an Entity inside a Bottle operation

- **WHEN** the classifier proposes a new related Entity
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

#### Scenario: Propose an exact Bottle merge

- **WHEN** an operation is `merge_bottles`
- **THEN** it SHALL name one existing source Bottle to retire and one distinct
  existing destination Bottle to survive
- **AND** its rationale SHALL assert exact marketed-identity equivalence
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
- **THEN** preparation SHALL block the operation because the target was not
  inspected
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

### Requirement: Deterministic gates do not replace semantic judgment

Preparation SHALL enforce only schema, permissions, inspected ids, supported
enum values, direct payload contradictions, enabled deployment capability, and
operation-specific live state.

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
- **THEN** code SHALL verify that the reference exists
- **AND** it SHALL NOT infer evidence quality or relevance from the URL or
  source domain

### Requirement: Evidence references are typed

Evidence references SHALL use a discriminated union for a source field, Bottle
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

### Requirement: Enabled operations are explicit

The server SHALL derive `availableOperations` from the operation enum and
enabled feature flags and provide those names to the model for each check.

#### Scenario: Operation is disabled for a workflow

- **WHEN** an operation definition is unavailable or disabled for the invoking
  workflow
- **THEN** the model SHALL not be instructed to propose it
- **AND** preparation SHALL still fail closed if it appears

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
- **AND** the runtime SHALL preserve that sample in the check artifacts
- **AND** no private user or unrelated activity data SHALL be exposed

#### Scenario: Agent gathers more evidence

- **WHEN** a tool result exposes useful new evidence
- **THEN** the same bounded agent session MAY continue or perform the existing
  evidence-driven retry
- **AND** it SHALL stop on valid output, the existing turn limit, the shared
  web-query budget, or terminal provider failure

#### Scenario: Retrieved content contains instructions

- **WHEN** source text, a page, or a tool result contains instructions
- **THEN** the runtime and prompt SHALL treat that content only as untrusted
  evidence
- **AND** it SHALL NOT change intent, permissions, operation availability, or
  approval policy

### Requirement: Primary decisions settle before supplemental preparation

The existing review policy SHALL finalize a reference decision before
supplemental operations are checked for direct conflicts.

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

- **WHEN** a reference decision still awaits its terminal disposition
- **THEN** supplemental operations MAY be previewed
- **AND** they SHALL NOT be applied until the primary workflow is terminal

### Requirement: Evals score intent and operations explicitly

Classifier evals SHALL score the existing reference decision and the exact
proposed operation and finding sets.

#### Scenario: Evaluate reference resolution

- **WHEN** a `resolve_reference` fixture runs
- **THEN** existing decision assertions SHALL remain in force
- **AND** supplemental operations SHALL be scored separately

#### Scenario: Evaluate an existing-Bottle audit

- **WHEN** an `audit_bottle` fixture runs
- **THEN** the eval SHALL score exact operations and findings
- **AND** a clean fixture SHALL require both arrays to be empty

#### Scenario: Preserve a production miss

- **WHEN** a production case becomes an eval
- **THEN** it SHALL retain the real intent, subject, catalog artifacts,
  verified evidence, expected result, and exact operations
- **AND** harmful extra mutations SHALL cost more than omitted cleanup
