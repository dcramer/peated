## ADDED Requirements

### Requirement: Every Bottle belongs to one automatic group

The system SHALL assign every Bottle to exactly one BottleGroup and SHALL create the necessary group automatically when an independent Bottle is created.

#### Scenario: Create a singleton Bottle

- **WHEN** a Bottle is created through an ordinary manual or public/API workflow
- **THEN** the system atomically creates a singleton BottleGroup and assigns the Bottle to it
- **AND** the user is not asked to create or name a separate group
- **AND** no source Bottle or group identifier is accepted as grouping authority

#### Scenario: Atomic creation fails

- **WHEN** creation of the group, Bottle, or required targets fails
- **THEN** none of those records are committed

### Requirement: Trusted group reuse is internal

The system SHALL expose trusted group reuse only to deterministic migration,
measured legacy compatibility adapters, and explicitly system-controlled
grouping operations, never as an ordinary/manual Bottle creation choice.

#### Scenario: Prefill another release from a Bottle

- **WHEN** a user starts “add another release” from an existing Bottle
- **THEN** the form may prefill a complete Bottle draft from that Bottle
- **AND** submission uses ordinary independent creation and receives a new
  singleton BottleGroup
- **AND** the source Bottle's `groupId` is not creation authority

#### Scenario: Migrate parent releases

- **WHEN** multiple BottleReleases under one legacy parent are promoted
- **THEN** every promoted Bottle belongs to the BottleGroup created from that parent

#### Scenario: Translate a legacy source-bound create

- **WHEN** a retained measured compatibility adapter receives a legacy contract
  whose source Bottle defines deterministic group context
- **THEN** the adapter may invoke internal trusted-source creation
- **AND** no ordinary client gains that capability

### Requirement: Semantic grouping runs outside ordinary creation

The system SHALL keep automatic semantic grouping separate from the ordinary
Bottle creation request and SHALL NOT require a user to choose a BottleGroup.

#### Scenario: Group a newly created singleton

- **WHEN** a later system-controlled grouping process establishes that two
  singleton groups represent the same expression
- **THEN** it may consolidate them through the audited group operation
- **AND** the original Bottle creation remains an independently valid operation

### Requirement: Uncertain grouping is not automatic

The system MUST NOT merge independently created BottleGroups solely because their names are similar, their brands match, or their Bottles share a series.

#### Scenario: Likely name match

- **WHEN** an independently created Bottle resembles a Bottle in another group
  but the automatic grouping policy lacks sufficient evidence
- **THEN** the system keeps the new Bottle in its singleton group
- **AND** may present the other group as a reviewable suggestion

#### Scenario: Same series

- **WHEN** two Bottles belong to the same BottleSeries but represent different marketed expressions
- **THEN** they remain in separate BottleGroups

### Requirement: Groups represent same-expression releases

BottleGroup membership SHALL mean that member Bottles are marketed versions, batches, years, or editions of the same expression; BottleSeries SHALL remain a broader relationship across potentially distinct expressions.

#### Scenario: Batch variants

- **WHEN** Springbank 12 Cask Strength Batch 23 and Batch 24 are curated as versions of the same expression
- **THEN** they belong to one BottleGroup as two Bottles

#### Scenario: Distinct expressions in a range

- **WHEN** two Octomore numbered expressions are related by range but marketed as distinct products
- **THEN** they remain in separate BottleGroups even if they share a BottleSeries

### Requirement: Group merge is explicit and reversible

The system SHALL provide an audited moderator user operation that merges one
source BottleGroup into one explicitly selected destination without changing
member Bottle ids or exact target ids.

#### Scenario: Merge two groups

- **WHEN** a moderator confirms that two groups describe the same expression
- **THEN** all member Bottles move to the selected destination group
- **AND** the destination shared identity atomically rematerializes every moved
  Bottle while preserving its exact fields
- **AND** every previous canonical exact name remains an exact alias for the same
  Bottle
- **AND** generic activity and stable aliases repoint to the destination generic
  target
- **AND** the source generic target and group are removed after their references
  move
- **AND** the retired source group id resolves through a durable tombstone

#### Scenario: Consolidate duplicate set membership

- **WHEN** source and destination generic targets both occur in the same
  collection or flight during a merge
- **THEN** duplicate flight membership collapses to one destination row
- **AND** the destination collection row wins
- **AND** a blank destination collection image may be filled from the source row

#### Scenario: Ambiguous merge conflict

- **WHEN** a merge encounters a tasting uniqueness collision or unresolved
  Bottle identity, alias, or SMWS conflict
- **THEN** the complete merge rolls back
- **AND** the system does not choose, discard, or suffix an ambiguous record

#### Scenario: Retry a completed merge

- **WHEN** the same source-to-destination merge is submitted after the source
  tombstone already points to that destination
- **THEN** the operation succeeds without adding audits or dispatching work
- **AND** a retry naming a different destination fails with a conflict

#### Scenario: Retain a reversible audit

- **WHEN** a group merge commits
- **THEN** the system stores BottleGroup before/after audit snapshots and one
  update audit per moved Bottle
- **AND** the audit records the actor, source, destination, moved identity, and
  alias context needed for an explicit reversal
- **AND** destination group aggregates are recomputed from raw exact and generic
  target activity without double counting

### Requirement: Group split preserves exact identity

The system SHALL provide an audited moderator operation to move selected Bottles into a new BottleGroup without changing their exact identities.

#### Scenario: Split incorrectly grouped Bottles

- **WHEN** a moderator selects member Bottles and splits them from a group
- **THEN** the system creates a new group and moves those Bottles
- **AND** their `bottleId` and exact `targetId` values remain unchanged
- **AND** ambiguous generic activity remains on the source group unless explicitly reassigned

### Requirement: Group aggregation is deterministic

The system SHALL calculate BottleGroup statistics from all member Bottle targets plus direct generic-group activity without double-counting exact activity.

#### Scenario: Aggregate exact and generic tastings

- **WHEN** a group has tastings on two exact Bottles and one tasting directly on the group target
- **THEN** the group aggregate includes all three sets once
- **AND** each Bottle aggregate includes only its own exact tastings

### Requirement: Group presentation has an explicit source

The system SHALL use a designated representative Bottle or group-owned editorial content for group presentation rather than opportunistically copying a child during reads.

#### Scenario: Representative Bottle changes

- **WHEN** a moderator changes the group's representative Bottle
- **THEN** group presentation uses the new representative deterministically
- **AND** member Bottle content is not rewritten
