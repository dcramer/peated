## ADDED Requirements

### Requirement: BottleSeries release total source

The system SHALL define a BottleSeries release total as the number of active Bottle rows whose `seriesId` references that BottleSeries. A Bottle without a BottleSeries SHALL not affect any BottleSeries release total.

#### Scenario: Bottle belongs to a series

- **WHEN** an active Bottle references a BottleSeries
- **THEN** that Bottle contributes exactly one to the BottleSeries release total

#### Scenario: Bottle has no series

- **WHEN** an active Bottle has no BottleSeries
- **THEN** it contributes to no BottleSeries release total

### Requirement: Transactional release-total changes

The system SHALL save every BottleSeries release-total change in the same transaction as the Bottle membership change that caused it. A queue job SHALL NOT be required for a normal Bottle write to leave the total correct.

#### Scenario: Bottle is added

- **WHEN** a Bottle assigned to a BottleSeries is created
- **THEN** that BottleSeries release total increases by one in the creation transaction

#### Scenario: Bottle is deleted

- **WHEN** a Bottle assigned to a BottleSeries is deleted
- **THEN** that BottleSeries release total decreases by one in the deletion transaction

#### Scenario: BottleGroup changes series

- **WHEN** a shared Bottle update moves active member Bottles from one BottleSeries to another
- **THEN** the old and new BottleSeries totals change by the number of moved Bottles in the update transaction

#### Scenario: Bottle merge within one series

- **WHEN** two Bottles in the same BottleSeries are merged into one Bottle
- **THEN** that BottleSeries release total decreases by one in the merge transaction

#### Scenario: Bottle merge across series

- **WHEN** a Bottle is merged into a surviving Bottle assigned to another BottleSeries
- **THEN** the retired Bottle's series loses one release and the surviving Bottle's series remains counted once

#### Scenario: BottleSeries merge

- **WHEN** one BottleSeries is merged into another
- **THEN** the surviving BottleSeries total matches all Bottles moved to it before the retired BottleSeries is removed

#### Scenario: Entity merge changes BottleSeries ownership

- **WHEN** an Entity merge moves or combines BottleSeries rows
- **THEN** every surviving BottleSeries total matches its Bottle membership when the merge commits

### Requirement: Concurrent release-total changes

The system SHALL preserve every committed release-total change when Bottle operations overlap. When one operation affects several BottleSeries rows, it SHALL change those rows in ascending BottleSeries ID order.

#### Scenario: Two Bottles are added concurrently

- **WHEN** two transactions add Bottles to the same BottleSeries
- **THEN** the saved total includes both committed Bottles

#### Scenario: Repair overlaps a Bottle change

- **WHEN** a BottleSeries repair overlaps a committed Bottle membership change
- **THEN** the final saved total includes the committed change

### Requirement: Damaged totals do not block valid Bottle removal

The system SHALL prevent negative BottleSeries totals. If an existing saved total is too low for a deletion or merge decrement, the system SHALL repair that BottleSeries from its current Bottle membership within the same transaction instead of rejecting the valid Bottle operation.

#### Scenario: Deletion encounters an old zero total

- **WHEN** a Bottle is deleted from a BottleSeries whose saved total is incorrectly zero
- **THEN** the deletion commits and the BottleSeries total is repaired to the remaining active Bottle count

#### Scenario: Referenced BottleSeries is missing

- **WHEN** a Bottle operation must change a BottleSeries that no longer exists
- **THEN** the transaction fails as an invalid catalog relationship

### Requirement: Bounded BottleSeries release-total repair

The system SHALL provide an administrator-started job that finds wrong BottleSeries release totals and repairs one BottleSeries per transaction while Bottle editing continues.

#### Scenario: Wrong saved total

- **WHEN** the repair job finds a BottleSeries whose saved total differs from its active Bottle count
- **THEN** it locks that BottleSeries, checks the count again, and saves the current active Bottle count

#### Scenario: Correct saved total

- **WHEN** a checked BottleSeries already has the correct release total
- **THEN** the repair leaves it unchanged

#### Scenario: BottleSeries changed after the scan

- **WHEN** Bottle membership changes after the broad scan but before that BottleSeries is repaired
- **THEN** the locked recheck uses the newer committed Bottle membership

#### Scenario: Candidate BottleSeries was removed

- **WHEN** a BottleSeries found by the scan no longer exists when its repair begins
- **THEN** the repair skips it without recreating it

#### Scenario: Repair is requested from Maintenance

- **WHEN** an administrator starts the existing Bottle-count repair action
- **THEN** the system uniquely queues the BottleSeries release-total repair job along with the other Bottle-count repairs

### Requirement: Strict repair job input

The BottleSeries repair job SHALL accept only an empty object and SHALL reject unknown fields.

#### Scenario: Unexpected job field

- **WHEN** the repair job receives any input field
- **THEN** it rejects the input before reading or changing BottleSeries totals
