## ADDED Requirements

### Requirement: Correct BottleGroup Bottle totals

The system SHALL store the number of active member Bottles on each BottleGroup without depending on queued work.

#### Scenario: Create a Bottle

- **WHEN** the system creates a Bottle and its singleton BottleGroup
- **THEN** the BottleGroup total is one in the creation transaction

#### Scenario: Update Bottle fields or relationships

- **WHEN** a Bottle update changes fields or relationships without changing BottleGroup membership
- **THEN** the BottleGroup total remains unchanged

#### Scenario: Delete a Bottle

- **WHEN** the system deletes a Bottle from a group that retains active members
- **THEN** the BottleGroup total equals the remaining active members before the deletion commits

#### Scenario: Merge Bottles

- **WHEN** the system merges an exact duplicate within one group or across two groups
- **THEN** every retained BottleGroup total equals its remaining active members before the merge commits

### Requirement: Consistent BottleGroup locks

The system SHALL lock a BottleGroup before its member Bottles when an operation needs both.

#### Scenario: Statistics overlap deletion

- **WHEN** BottleGroup statistics or repair overlaps deletion of a member Bottle
- **THEN** the operations wait in the same lock order and each committed result reflects the active members at that point

### Requirement: Bounded BottleGroup count repair

The system SHALL compare BottleGroup totals with an independent active-member count and SHALL repair each wrong group in a separate transaction while catalog work continues.

#### Scenario: Check correct totals

- **WHEN** saved BottleGroup totals match their active member Bottles
- **THEN** the check reports no differences and changes no data

#### Scenario: Repair a wrong total

- **WHEN** a saved BottleGroup total is wrong
- **THEN** repair locks that group, checks it again, and saves its current active-member count

#### Scenario: Repair overlaps a catalog change

- **WHEN** repair waits for a Bottle deletion or merge on the same BottleGroup
- **THEN** repair recounts after that catalog transaction commits and does not restore its older total

#### Scenario: Repair an empty old group

- **WHEN** an existing BottleGroup has no active member Bottles
- **THEN** repair saves a total of zero without deleting the group or changing catalog links

#### Scenario: Start repair more than once

- **WHEN** an administrator starts Bottle-count repair while the BottleGroup repair is waiting or running
- **THEN** the system keeps one active BottleGroup repair job
