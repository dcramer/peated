## ADDED Requirements

### Requirement: Activity uses one catalog target id

The system SHALL represent the catalog subject of tastings, reviews, collection entries, flights, prices, aliases, observations, classifier decisions, repair proposals, and activity events with one `targetId` rather than an independently supplied `(bottleId, releaseId)` pair.

#### Scenario: Store exact activity

- **WHEN** activity is associated with an identified Bottle
- **THEN** the consumer row references that Bottle's exact catalog target

#### Scenario: Store unknown-exactness activity

- **WHEN** the expression is known but the exact Bottle is not
- **THEN** the consumer row references the BottleGroup's generic catalog target

### Requirement: Aliases preserve exact or generic target intent

The system SHALL assign aliases through one validated CatalogTarget operation.
Exact marketed aliases SHALL reference an exact Bottle target, stable aliases
SHALL reference a generic BottleGroup target, and compatibility translation
SHALL NOT overwrite a durable target with a legacy pair.

#### Scenario: Assign a moderator Bottle alias

- **WHEN** a moderator assigns an alias using a Bottle id
- **THEN** the system resolves and stores that Bottle's active exact target
- **AND** it does not infer a stable alias for the BottleGroup

#### Scenario: Resolve an exact alias

- **WHEN** an accepted alias references an exact target
- **THEN** exact alias lookup returns that target's Bottle directly
- **AND** it does not reconstruct a BottleRelease identity

#### Scenario: Encounter a generic alias during exact lookup

- **WHEN** an accepted alias references a generic target
- **THEN** the alias remains BottleGroup identity
- **AND** the system does not substitute the representative or another member
  Bottle

#### Scenario: Resolve a legacy targetless alias

- **WHEN** a compatibility lookup encounters an alias whose `targetId` is null
- **THEN** it may use the instrumented legacy pair resolver
- **AND** a non-null target never uses the legacy pair fallback

#### Scenario: Unassign an alias

- **WHEN** a moderator deletes an alias association
- **THEN** the alias row's target id and retained legacy pair are cleared together
- **AND** consumer target-clearing semantics are not inferred from the alias row

### Requirement: Existing-match price evidence shares one target

The system SHALL resolve one CatalogTarget for an approved existing-match or
correction store-price proposal and SHALL atomically use that same target for
its listing alias and source observation without changing the retained
price-assignment contract.

#### Scenario: Approve an exact promoted release

- **WHEN** an approved existing match carries a legacy pair whose release has a completed promotion
- **THEN** the measured legacy resolver selects the promoted Bottle's exact target once
- **AND** the listing alias and observation both store that target

#### Scenario: Approve a parent-only match

- **WHEN** an approved existing match carries a parent Bottle with no release id
- **THEN** the measured legacy resolver follows the deterministic parent-cardinality rule
- **AND** both writes use the generic group target when the parent has releases
- **AND** both writes use the retained Bottle's exact target when it has no releases
- **AND** a generic result does not substitute the representative Bottle

#### Scenario: Approval cannot persist one target-backed record

- **WHEN** target resolution, listing-alias assignment, or observation persistence fails
- **THEN** the approval transaction rolls back
- **AND** it does not commit different targets or only one of the two records

#### Scenario: Retain adjacent compatibility contracts

- **WHEN** the alias and observation are assigned their shared target
- **THEN** existing price, proposal, and decision-log Bottle/Release pair semantics remain unchanged
- **AND** proposal decision vocabulary remains unchanged until its explicit cutover

#### Scenario: Approve a create-new proposal before creation cutover

- **WHEN** create-new approval still creates ungrouped legacy Bottle or BottleRelease rows
- **THEN** its alias and observation remain on the measured targetless compatibility path
- **AND** the system does not claim that those records are target-backed
- **AND** a later task assigns the newly created concrete target after creation and decision vocabulary are cut over

### Requirement: Target integrity is database enforced

The system SHALL enforce one generic target per BottleGroup, one exact target per Bottle, and consistency between an exact target's Bottle and BottleGroup.

#### Scenario: Create an inconsistent exact target

- **WHEN** a write attempts to pair a Bottle with a BottleGroup it does not belong to
- **THEN** the database rejects the write

#### Scenario: Create a duplicate target

- **WHEN** a write attempts to create a second generic target for a group or a second exact target for a Bottle
- **THEN** the database rejects the write

### Requirement: Target results are discriminated

The API SHALL return a discriminated target result that identifies whether the target is an exact Bottle or a generic BottleGroup and includes only valid hydrated objects for that kind.

#### Scenario: Load an exact target

- **WHEN** an exact target is requested
- **THEN** the result contains `kind: "bottle"`, its Bottle, and its BottleGroup

#### Scenario: Load a generic target

- **WHEN** a generic target is requested
- **THEN** the result contains `kind: "group"` and its BottleGroup
- **AND** it does not invent a representative exact Bottle as the activity target

### Requirement: Legacy references migrate deterministically

The migration SHALL populate target ids from legacy references using release promotion and parent cardinality without guessing exact identity.

#### Scenario: Legacy release reference

- **WHEN** a legacy row has a non-null `releaseId`
- **THEN** it maps to the exact target of the Bottle promoted from that release

#### Scenario: Generic reference under a parent with releases

- **WHEN** a legacy row has a null `releaseId` and its parent has one or more releases
- **THEN** it maps to the parent's BottleGroup target

#### Scenario: Reference under a parent without releases

- **WHEN** a legacy row has a null `releaseId` and its parent has no releases
- **THEN** it maps to the retained Bottle's exact target

### Requirement: Target migration is auditable and resumable

The system SHALL provide idempotent backfill commands and dry-run reports covering every target-bearing table, legacy release mapping, collision, and unresolved identity condition.

#### Scenario: Backfill is interrupted

- **WHEN** a target backfill batch stops before completion and is run again
- **THEN** completed mappings are reused
- **AND** remaining rows are processed without duplicate Bottles, groups, or targets

#### Scenario: Audit finds an ambiguous parent

- **WHEN** a parent with child releases also contains unresolved release-like fields or a promoted name collides
- **THEN** the audit reports the record and blocks destructive cleanup until it has an explicit disposition

### Requirement: Read cutover proves parity

The system SHALL compare legacy and target-based resolution during a parity period and SHALL block constraint and cleanup cutovers while mismatches or unmapped references remain.

#### Scenario: Parity mismatch

- **WHEN** a target-based read resolves a different exact or generic identity from its legacy reference
- **THEN** the mismatch is recorded
- **AND** removal of the legacy columns remains blocked

### Requirement: Compatibility never chooses an arbitrary Bottle

Compatibility routes SHALL return replacement target information or redirect mappings and SHALL NOT choose a member Bottle when a legacy reference was generic.

#### Scenario: Resolve a retired generic parent

- **WHEN** an old parent URL or API reference maps to a BottleGroup target
- **THEN** the system returns or redirects to the group identity
- **AND** it does not substitute the representative Bottle as the target

#### Scenario: Resolve a merged source group

- **WHEN** a group merge has repointed every source-generic reference and removed
  the source generic target and BottleGroup rows
- **THEN** the source group tombstone identifies the selected destination group
- **AND** exact Bottle ids and exact target ids from the merged source remain
  unchanged
