## ADDED Requirements

### Requirement: Collection Bottle total source

The system SHALL define a Collection Bottle total as the number of Bottle membership rows that reference that Collection. Each membership row SHALL contribute exactly one regardless of its status or image.

#### Scenario: Bottle belongs to a Collection

- **WHEN** a Bottle membership row references a Collection
- **THEN** that row contributes exactly one to the Collection Bottle total

#### Scenario: Membership details change

- **WHEN** a membership's status or image changes without adding, removing, or moving the row
- **THEN** the Collection Bottle total does not change

### Requirement: Transactional Collection count changes

The system SHALL save every Collection Bottle count change in the same transaction as the membership change that caused it. A queue job SHALL NOT be required for a normal Collection write to leave the count correct.

#### Scenario: Membership is added

- **WHEN** a Bottle membership is added to a Collection
- **THEN** that Collection Bottle total increases by one in the creation transaction

#### Scenario: Membership is removed

- **WHEN** a Bottle membership is removed from a Collection
- **THEN** that Collection Bottle total decreases by one in the removal transaction

#### Scenario: Duplicate add is ignored

- **WHEN** adding a Bottle finds that the Collection already contains it
- **THEN** no membership or count is added

#### Scenario: Failed image upload removes a new membership

- **WHEN** cleanup removes a membership created for an image upload that did not finish
- **THEN** the Collection Bottle total decreases in the cleanup transaction

#### Scenario: Cleanup finds the membership already removed

- **WHEN** failed-image cleanup finds that its new membership was already removed
- **THEN** the Collection Bottle total does not change again

#### Scenario: Bottle merge moves a membership

- **WHEN** a Bottle merge changes a membership to the surviving Bottle without finding a duplicate in that Collection
- **THEN** the Collection Bottle total does not change

#### Scenario: Bottle merge combines duplicate memberships

- **WHEN** a Bottle merge combines source and destination memberships in one Collection
- **THEN** that Collection Bottle total decreases by one in the merge transaction

### Requirement: Concurrent Collection count changes

The system SHALL preserve every committed Collection Bottle count change when membership operations overlap. When one operation affects several Collections, it SHALL change those rows in ascending Collection ID order.

#### Scenario: Two memberships are added concurrently

- **WHEN** two transactions add different Bottles to the same Collection
- **THEN** the saved total includes both committed memberships

#### Scenario: Repair overlaps a membership change

- **WHEN** a Collection repair overlaps a committed membership change
- **THEN** the final saved total includes the committed change

### Requirement: Damaged totals do not block valid membership removal

The system SHALL prevent negative Collection Bottle totals. If an existing saved total is too low for a removal or Bottle merge decrement, the system SHALL repair that Collection from its current membership rows within the same transaction instead of rejecting the valid operation.

#### Scenario: Removal encounters an old zero total

- **WHEN** a membership is removed from a Collection whose saved total is incorrectly zero
- **THEN** the removal commits and the Collection total is repaired to the remaining membership count

#### Scenario: Referenced Collection is missing

- **WHEN** a membership operation must change a Collection that no longer exists
- **THEN** the transaction fails as an invalid relationship

### Requirement: Bounded Collection Bottle count repair

The system SHALL provide an administrator-started job that finds wrong Collection Bottle totals and repairs one Collection per transaction while Collection editing continues.

#### Scenario: Wrong saved total

- **WHEN** the repair job finds a Collection whose saved total differs from its membership count
- **THEN** it locks that Collection, checks the count again, and saves the current membership count

#### Scenario: Correct saved total

- **WHEN** a checked Collection already has the correct Bottle total
- **THEN** the repair leaves it unchanged

#### Scenario: Collection changed after the scan

- **WHEN** membership changes after the broad scan but before that Collection is repaired
- **THEN** the locked check uses the newer committed membership

#### Scenario: Candidate Collection was removed

- **WHEN** a Collection found by the scan no longer exists when its repair begins
- **THEN** the repair skips it without recreating it

#### Scenario: Repair is requested from Maintenance

- **WHEN** an administrator starts the existing Bottle-count repair action
- **THEN** the system uniquely queues the Collection Bottle count repair job with the other Bottle-count repairs

### Requirement: Strict repair job input

The Collection Bottle count repair job SHALL accept only an empty object and SHALL reject unknown fields.

#### Scenario: Unexpected job field

- **WHEN** the repair job receives any input field
- **THEN** it rejects the input before reading or changing Collection totals
