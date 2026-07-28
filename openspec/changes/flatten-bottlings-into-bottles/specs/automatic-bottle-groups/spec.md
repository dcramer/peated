## ADDED Requirements

### Requirement: Every Bottle belongs to one automatic group

The system SHALL assign every Bottle to exactly one BottleGroup and SHALL
create a singleton group automatically for every ordinary Bottle creation.

#### Scenario: Create a Bottle

- **WHEN** a Bottle is created through a manual, public API, classifier, import,
  or price-approval workflow
- **THEN** the system atomically creates a singleton BottleGroup and assigns the
  Bottle to it
- **AND** the caller cannot supply group authority

#### Scenario: Atomic creation fails

- **WHEN** creation of the group, Bottle, aliases, or audit records fails
- **THEN** none of those records are committed

### Requirement: Grouping runs outside Bottle creation

The system SHALL keep semantic grouping outside ordinary Bottle creation and
SHALL NOT ask users to select, create, merge, or split BottleGroups.

#### Scenario: Add another release

- **WHEN** a user starts “add another release” from an existing Bottle
- **THEN** the source pre-fills an independently complete Bottle draft
- **AND** submission creates a new Bottle in a singleton group
- **AND** a later system-controlled process may group it

#### Scenario: Migrate a legacy family

- **WHEN** a legacy parent and its BottleReleases are migrated
- **THEN** the retained parent and all promoted Bottles belong to one group
- **AND** this deterministic grouping is internal migration behavior

### Requirement: Group membership means related releases

BottleGroup membership SHALL indicate that its Bottles are versions, batches,
years, editions, or a general/unversioned form of the same expression.
BottleSeries SHALL remain a broader merchandising relationship.

#### Scenario: Batch variants

- **WHEN** two batches are established as versions of one expression
- **THEN** they may belong to one BottleGroup as separate Bottles

#### Scenario: Uncertain similarity

- **WHEN** evidence is insufficient to establish the same expression
- **THEN** the Bottles remain in separate singleton groups
- **AND** name, brand, or series similarity alone does not silently merge them

### Requirement: BottleGroup is relational, not targetable

BottleGroup SHALL provide relationship, shared-presentation, and aggregation
scope, but SHALL NOT be selectable as activity or catalog-consumer identity.

#### Scenario: Render related releases

- **WHEN** a user opens `/bottles/:memberBottleId/releases`
- **THEN** the member locates its group
- **AND** the page lists the group's independently complete member Bottles
- **AND** user-facing copy describes related or other releases without exposing
  BottleGroup ids

#### Scenario: Start an activity workflow

- **WHEN** a user starts a tasting, review, collection, Flight, or price action
  from the relationship page
- **THEN** the action requires a member Bottle

### Requirement: Shared changes rematerialize member Bottles

A trusted shared BottleGroup update SHALL transactionally regenerate the
shared materialized fields and complete names of every affected member Bottle.

#### Scenario: Change the shared name

- **WHEN** a trusted shared edit changes the shared Bottle name prefix
- **THEN** every member Bottle receives a newly materialized complete name
- **AND** each previous canonical name remains an alias for the same Bottle
- **AND** any collision rolls back the entire change

#### Scenario: Read a Bottle

- **WHEN** any API, page, search result, worker, or serializer loads a Bottle
- **THEN** the Bottle is independently correct without BottleGroup hydration

### Requirement: Group aggregation is member-derived

The system SHALL calculate BottleGroup statistics from raw activity assigned to
its member Bottles without double counting.

#### Scenario: Aggregate member activity

- **WHEN** a group contains two Bottles with activity
- **THEN** the group aggregate includes each member's raw activity once
- **AND** no direct BottleGroup activity exists

### Requirement: Group presentation is deterministic

The system SHALL use group-owned shared presentation data and a valid
representative Bottle only as a deterministic route or image source.

#### Scenario: Representative changes

- **WHEN** the representative Bottle changes
- **THEN** relationship routes and presentation use the new representative
- **AND** no activity identity changes
