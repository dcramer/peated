## ADDED Requirements

### Requirement: Source-scoped score restoration

The system SHALL restore a Whisky Advocate review's native score from its
preserved legacy score only when the legacy value is a whole number from 1
through 100 and all native-score fields are empty.

#### Scenario: Restore an eligible legacy score

- **WHEN** an administrator runs the repair for a Whisky Advocate review with a
  legacy score of 92 and no native score
- **THEN** the review retains the legacy score and stores a native score of
  `92/100`

#### Scenario: Preserve a current native score

- **WHEN** an eligible source review already has any complete native score
- **THEN** the repair leaves that native score unchanged

#### Scenario: Leave weak legacy data unknown

- **WHEN** a Whisky Advocate review has no legacy score or a legacy score outside
  the publisher's valid range
- **THEN** the repair leaves its native score empty and reports it as skipped

#### Scenario: Exclude another source

- **WHEN** another review source has a legacy score and no native score
- **THEN** the Whisky Advocate repair leaves it unchanged

### Requirement: Protected idempotent operation

The system MUST restrict the repair operation to administrators and SHALL make
repeated calls safe.

#### Scenario: Unauthorized request

- **WHEN** a non-administrator calls the repair operation
- **THEN** the request fails without changing reviews or queueing summary work

#### Scenario: Repeat a completed repair

- **WHEN** an administrator repeats the operation after scores were restored
- **THEN** no native score is overwritten and affected Bottle summary updates
  can be queued again

### Requirement: Summary refresh and verification counts

The system SHALL queue summary updates for distinct Bottles affected by restored
Whisky Advocate scores and return aggregate repair counts.

#### Scenario: Repair matched and unmatched reviews

- **WHEN** the repair restores scores on matched and unmatched reviews
- **THEN** it queues each distinct matched Bottle once and reports changed,
  skipped, affected-Bottle, and queued-update counts

#### Scenario: Record the repair

- **WHEN** an administrator completes the operation
- **THEN** the system records a source-scoped audit event containing aggregate
  result counts without publisher text or private user data
