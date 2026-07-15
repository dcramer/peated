## ADDED Requirements

### Requirement: Every Bottle belongs to one automatic group

The system SHALL assign every Bottle to exactly one BottleGroup and SHALL create the necessary group automatically when an independent Bottle is created.

#### Scenario: Create a singleton Bottle

- **WHEN** a Bottle is created without a trusted existing group context
- **THEN** the system atomically creates a singleton BottleGroup and assigns the Bottle to it
- **AND** the user is not asked to create or name a separate group

#### Scenario: Atomic creation fails

- **WHEN** creation of the group, Bottle, or required targets fails
- **THEN** none of those records are committed

### Requirement: Trusted context reuses a group

The system SHALL reuse an existing BottleGroup when another Bottle is created through an explicit existing-member, migrated-parent, curated-alias, or moderator-approved context.

#### Scenario: Add another release from a Bottle

- **WHEN** a user creates another release from an existing Bottle
- **THEN** the new Bottle receives the existing Bottle's `groupId`

#### Scenario: Migrate parent releases

- **WHEN** multiple BottleReleases under one legacy parent are promoted
- **THEN** every promoted Bottle belongs to the BottleGroup created from that parent

### Requirement: Uncertain grouping is not automatic

The system MUST NOT merge independently created BottleGroups solely because their names are similar, their brands match, or their Bottles share a series.

#### Scenario: Likely name match

- **WHEN** an independently created Bottle resembles a Bottle in another group but no trusted relationship exists
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

The system SHALL provide an audited moderator operation to merge BottleGroups without changing member Bottle ids or exact target ids.

#### Scenario: Merge two groups

- **WHEN** a moderator confirms that two groups describe the same expression
- **THEN** all member Bottles move to the selected destination group
- **AND** generic activity and aliases are consolidated
- **AND** the source group resolves through a tombstone

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
