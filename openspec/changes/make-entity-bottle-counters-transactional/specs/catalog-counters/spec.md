## ADDED Requirements

### Requirement: Transactional Entity Bottle totals

The system SHALL update every affected Entity's distinct active Bottle count in the same transaction that changes the saved Bottle links.

#### Scenario: Create an active Bottle

- **WHEN** a Bottle is created with Brand, optional Bottler, and Distillery relationships
- **THEN** each unique related Entity's Bottle total increases by one in the creation transaction

#### Scenario: Change Bottle relationships

- **WHEN** an active Bottle changes any Brand, Bottler, or Distillery relationship
- **THEN** counts change only for Entities whose Bottle links changed

#### Scenario: Delete or merge Bottles

- **WHEN** a Bottle is deleted or merged into another Bottle
- **THEN** each affected Entity total reflects the active Bottles remaining at commit

#### Scenario: One Entity has several roles

- **WHEN** one Entity is related to the same Bottle as Brand, Bottler, and/or Distillery
- **THEN** that Bottle contributes exactly one to the Entity total

### Requirement: Safe count updates

The system SHALL save Entity Bottle count changes in the Bottle transaction and SHALL reject a change that refers to a missing Entity or would produce a negative count.

#### Scenario: Concurrent Bottle creation

- **WHEN** concurrent transactions add different Bottles related to the same Entity
- **THEN** the final Entity total includes both Bottles without a lost update

#### Scenario: Invalid decrease

- **WHEN** a change would take the saved count below zero
- **THEN** the Bottle transaction fails without changing the Bottle or count

### Requirement: Separate count check

The system SHALL calculate Entity Bottle counts from active saved Bottle links without using the regular count update code.

#### Scenario: Check correct counts

- **WHEN** stored Entity totals equal the independent calculation
- **THEN** the check reports no differences and changes no data

#### Scenario: Detect and repair drift

- **WHEN** a saved Entity count differs from the count shown by Bottle links
- **THEN** the check identifies the Entity, saved count, and actual count, and an explicit repair saves the actual count

#### Scenario: Repair while Bottle edits continue

- **WHEN** an administrator starts the repair job while Bottle edits are being saved
- **THEN** each wrong Entity count is locked, recounted, and saved separately without losing a concurrent Bottle count change

#### Scenario: Start the same repair twice

- **WHEN** an administrator starts the repair while the same job is queued or running
- **THEN** the system keeps one active repair job

### Requirement: Queue independence

Normal Entity Bottle total correctness SHALL NOT depend on a queued job completing.

#### Scenario: Post-save worker does not run

- **WHEN** a Bottle catalog transaction commits and no post-save worker runs
- **THEN** every affected Entity Bottle total is already correct
