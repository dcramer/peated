## ADDED Requirements

### Requirement: Full store-price classification retains Bottle review evidence

The system SHALL create a linked `resolve_reference` Bottle check after each completed full store-price classifier run. The check SHALL retain the run's findings and proposed Bottle operations and SHALL link to the exact store-price match attempt produced by that run.

#### Scenario: Initial unresolved listing is classified

- **WHEN** initial store-price ingestion requires a full classifier run
- **THEN** the system records the primary store-price match proposal and attempt
- **AND** creates a Bottle check linked to that attempt from the same classifier result

#### Scenario: Store-price match is retried

- **WHEN** an individual or bulk retry completes a full classifier run
- **THEN** the system creates a Bottle check linked to the retry's match attempt without requiring a caller option

#### Scenario: Classifier ignores the reference

- **WHEN** a full store-price classifier run returns an ignored result
- **THEN** the system creates a Bottle check linked to the ignored match attempt from that classifier result

#### Scenario: Deterministic alias match bypasses classification

- **WHEN** store-price ingestion assigns a Bottle through the deterministic alias path without a full classifier run
- **THEN** the system does not create a classifier-derived Bottle check

#### Scenario: Linked check cannot be persisted

- **WHEN** the linked Bottle check from a full classifier result fails validation or persistence
- **THEN** the system does not retain a successful match proposal or attempt from that run
- **AND** records the run through the existing errored proposal and attempt path
- **AND** does not begin automated catalog mutation

### Requirement: Price matching and Bottle operations keep separate authority

The system SHALL keep the store-price match proposal authoritative for the listing's Bottle assignment. Supplemental Bottle operations SHALL remain attached to the linked Bottle check and SHALL require their existing moderator review.

#### Scenario: Classifier proposes supplemental Bottle operations

- **WHEN** a full store-price classifier run returns proposed Bottle operations
- **THEN** the operations are available through the linked check in the existing Incoming Listings review flow
- **AND** the operations do not replace or implicitly approve the primary store-price match decision
