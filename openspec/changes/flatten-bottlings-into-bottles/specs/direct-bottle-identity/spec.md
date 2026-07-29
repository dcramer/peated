## ADDED Requirements

### Requirement: Catalog consumers reference Bottle directly

The system SHALL use one `bottleId` as the catalog identity for tastings,
reviews, collection entries, flights, prices, aliases, observations,
classifier decisions, proposals, activity, statistics, and other catalog
consumers.

#### Scenario: Record activity

- **WHEN** a user records activity for a selected Bottle
- **THEN** the consumer row stores that Bottle's id
- **AND** it stores neither a BottleGroup activity target nor a BottleRelease id

#### Scenario: Return consumer identity

- **WHEN** an API or worker loads a catalog consumer
- **THEN** it returns the referenced independently complete Bottle
- **AND** BottleGroup information is optional relationship context only

### Requirement: BottleGroup is not an activity target

The system SHALL NOT allow a tasting, review, collection entry, flight member,
price, alias, observation, proposal, or activity event to select a BottleGroup
as its catalog identity.

#### Scenario: View related-release activity

- **WHEN** a related-release page displays activity for a BottleGroup
- **THEN** it derives the result from activity on member Bottles
- **AND** the BottleGroup owns no direct activity rows

#### Scenario: Select a Bottle in a workflow

- **WHEN** a workflow begins from a related-release page
- **THEN** the user selects a concrete or general Bottle
- **AND** the workflow does not offer an unspecified-group option

### Requirement: General Bottles preserve non-release-specific identity

The migration SHALL retain a legacy parent Bottle as a valid general or
unversioned Bottle when promoting its BottleReleases.

#### Scenario: Parent-only legacy reference

- **WHEN** a legacy consumer has a Bottle id and a null release id
- **THEN** its direct Bottle reference remains the legacy parent Bottle
- **AND** the migration does not assign it to a promoted release

#### Scenario: Release-specific legacy reference

- **WHEN** a legacy consumer references a BottleRelease
- **THEN** its Bottle reference becomes the Bottle promoted from that release
- **AND** the durable release-promotion mapping records the correspondence

#### Scenario: Parent with no releases

- **WHEN** a legacy Bottle has no BottleRelease children
- **THEN** it remains the same Bottle id in its singleton group

### Requirement: Direct Bottle integrity is database enforced

The database SHALL enforce valid Bottle foreign keys and domain-specific
Bottle membership uniqueness without a polymorphic catalog-target table.

#### Scenario: Invalid Bottle reference

- **WHEN** a consumer attempts to reference a missing Bottle
- **THEN** the database rejects the write

#### Scenario: Duplicate set membership

- **WHEN** the same Bottle is added twice to one collection or Flight
- **THEN** the database or canonical service prevents duplicate membership

### Requirement: Identity writers have one owner

Each consumer SHALL have one canonical operation that validates and writes its
Bottle identity atomically with the consumer mutation.

#### Scenario: Assign an alias

- **WHEN** an alias is assigned to a Bottle
- **THEN** alias propagation uses that same Bottle id for matching prices and
  reviews
- **AND** no second resolver chooses a BottleGroup or release

#### Scenario: Approve a price match

- **WHEN** a moderator approves a price match
- **THEN** the StorePrice, alias, observation, proposal, attempt, and decision
  evidence use the same Bottle id in one transaction

#### Scenario: Concurrent retarget

- **WHEN** a consumer identity changes after a writer's preflight
- **THEN** the compare-and-set or transaction fails rather than overwriting the
  newer Bottle identity

### Requirement: Legacy migration is fail-fast and auditable

The system SHALL provide a retained read-only preflight and resumable,
component-complete database transactions for the initial legacy data migration.

#### Scenario: Run production preflight

- **WHEN** an operator prepares the migration
- **THEN** a retained report records the exact Git revision, database revision,
  generation time, counts, collisions, invalid pairs, and unresolved ownership
- **AND** no production write is authorized until the report is reconciled and
  explicitly approved

#### Scenario: Apply the migration

- **WHEN** an approved migration begins
- **THEN** each bounded batch locks affected tables in a fixed order
- **AND** creates or validates whole groups, promoted Bottles, mappings,
  aliases, scoped direct Bottle references, and statistics atomically
- **AND** emits progress only after the batch commits

#### Scenario: Migration fails

- **WHEN** any collision, invalid pair, concurrent drift, or batch assertion
  fails
- **THEN** the current batch rolls back
- **AND** prior committed group checkpoints remain valid
- **AND** a rerun skips committed groups and resumes unfinished work

#### Scenario: Migration succeeds

- **WHEN** the transaction commits
- **THEN** a retained postflight reports row counts, release mappings, direct
  Bottle references, and group/member integrity
- **AND** legacy tables and columns remain until separately approved cleanup

### Requirement: Legacy references remain reachable

Compatibility routes SHALL translate legacy BottleRelease identity through the
durable promotion mapping and delegate to Bottle operations.

#### Scenario: Resolve a nested release URL

- **WHEN** an old nested BottleRelease URL references a promoted release
- **THEN** it permanently redirects to the promoted Bottle URL

#### Scenario: Translate a legacy API request

- **WHEN** a retained compatibility API receives a known release id
- **THEN** it resolves the mapped Bottle and delegates to the Bottle service
- **AND** it does not maintain a second release business-logic system

### Requirement: Statistics derive from Bottle activity

Bottle statistics SHALL use activity directly assigned to that Bottle, and
BottleGroup statistics SHALL aggregate raw activity across member Bottle ids.

#### Scenario: Recompute one Bottle

- **WHEN** Bottle statistics are recomputed
- **THEN** only consumer rows referencing that Bottle contribute

#### Scenario: Recompute one group

- **WHEN** BottleGroup statistics are recomputed
- **THEN** raw activity for all current member Bottle ids contributes once
- **AND** no generic group activity or materialized Bottle total is added
