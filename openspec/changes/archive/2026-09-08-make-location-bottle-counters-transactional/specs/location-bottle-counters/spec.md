## ADDED Requirements

### Requirement: Transactional location Bottle totals

The system SHALL update every affected Country and Region Bottle total in the same transaction that changes the active Bottle-to-Distillery links.

#### Scenario: Create an active Bottle

- **WHEN** a Bottle is created with Distilleries that have saved locations
- **THEN** each distinct Country and Region represented by those Distilleries gains one Bottle in the creation transaction

#### Scenario: Change producing Distilleries

- **WHEN** an active Bottle changes its Distillery relationships
- **THEN** totals change only for Countries and Regions that leave or enter the Bottle's production-location sets

#### Scenario: Delete or merge Bottles

- **WHEN** a Bottle is deleted or merged into another Bottle
- **THEN** each affected Country and Region total reflects the active Bottles remaining at commit

#### Scenario: Several Distilleries share a location

- **WHEN** one Bottle has several Distilleries in the same Country or Region
- **THEN** that Bottle contributes exactly one to that location total

### Requirement: Distillery location changes

The system SHALL update location Bottle totals in the Entity transaction when a linked Distillery's Country or Region changes.

#### Scenario: Move a Distillery

- **WHEN** a Distillery with active Bottles moves from one saved Country or Region to another
- **THEN** the old and new location totals reflect each affected Bottle at commit

#### Scenario: Another Distillery preserves the location

- **WHEN** a Bottle has another Distillery in a location that the changed Distillery leaves
- **THEN** the Bottle remains counted once in that location

### Requirement: Safe location count updates

The system SHALL apply atomic location count changes in a stable row order and SHALL repair an old undercount exposed by a valid catalog change.

#### Scenario: Concurrent Bottle creation

- **WHEN** concurrent transactions add different Bottles produced in the same location
- **THEN** the final location total includes both Bottles without a lost update

#### Scenario: Existing undercount

- **WHEN** deleting, merging, or updating a Bottle requires a decrease greater than the saved location total
- **THEN** the transaction locks that location, saves its exact total from the remaining active Bottle links, and completes the catalog change

### Requirement: Separate location count repair

The system SHALL check saved location totals against an independent calculation and SHALL allow an administrator to repair wrong totals while catalog edits continue.

#### Scenario: Check correct totals

- **WHEN** saved Country and Region totals match active Bottle-to-Distillery links
- **THEN** the check reports no differences and changes no data

#### Scenario: Repair wrong totals

- **WHEN** an administrator starts the Bottle-count repair and a location total is wrong
- **THEN** the system locks, recounts, and saves that location separately

#### Scenario: Start the repair twice

- **WHEN** an administrator starts the repair while the same repair jobs are waiting or running
- **THEN** the system keeps one active copy of each repair job

### Requirement: Queue-independent location totals

Normal Country and Region Bottle total correctness SHALL NOT depend on a queued job completing.

#### Scenario: Statistics jobs do not run

- **WHEN** a Bottle or Distillery location transaction commits and no later statistics job runs
- **THEN** every affected Country and Region Bottle total is already correct
