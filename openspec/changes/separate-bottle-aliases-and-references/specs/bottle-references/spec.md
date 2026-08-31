## ADDED Requirements

### Requirement: Bottle references own exact string resolution

A BottleReference SHALL be an internal assertion that one accepted reference string resolves to one Bottle. Only a non-quarantined reference assigned to an active Bottle SHALL bypass classification or propagate Bottle identity to eligible consumers.

#### Scenario: Resolve an active assigned reference

- **WHEN** ingestion receives a string equal to an active assigned BottleReference under accepted comparison rules
- **THEN** the system resolves directly to that Bottle

#### Scenario: Encounter an unresolved reference

- **WHEN** a BottleReference has no Bottle assignment
- **THEN** the system preserves it as unresolved evidence
- **AND** does not resolve a Bottle from it

#### Scenario: Encounter a quarantined reference

- **WHEN** ingestion receives a string equal to a quarantined BottleReference
- **THEN** the reference does not resolve a Bottle

### Requirement: Marketed titles do not grant matching authority

Bottle creation and ordinary title changes SHALL NOT create a BottleReference solely from the marketed title. Structured Bottle identity SHALL decide whether a title can be created or changed. Accepted source or moderator workflows SHALL assign matching references explicitly.

#### Scenario: Create structured releases with the same title

- **WHEN** two Bottles use the same marketed title but have different structured identities
- **THEN** the title alone does not block either Bottle
- **AND** the system does not create an exact reference from either title

#### Scenario: Preserve an SMWS subtitle

- **WHEN** an unchanged SMWS code proves that a Bottle subtitle was renamed
- **THEN** the previous title can remain a BottleReference for the same Bottle
- **AND** no displayed BottleAlias is created automatically

### Requirement: Existing reference data migrates without semantic drift

The cutover SHALL preserve every existing BottleAlias row as a BottleReference with the same name, Bottle assignment, ignored state, embedding, assignment provenance, actor, legacy release value, and creation time. The cutover SHALL NOT create BottleAliases from those rows.

#### Scenario: Run migration preflight

- **WHEN** an operator runs the retained production preflight
- **THEN** it reports bounded counts by assignment state, ignored state, assignment source, and Bottle ownership
- **AND** reports canonical coverage and case-insensitive name collisions

#### Scenario: Apply the cutover

- **WHEN** the schema and application cut over to BottleReference
- **THEN** every existing reference remains available with unchanged matching state
- **AND** the new BottleAlias collection starts empty except for separately reviewed seed data

#### Scenario: Run migration postflight

- **WHEN** the cutover completes
- **THEN** the retained postflight verifies the preflight counts and reference identity fields
- **AND** reports any mismatch as a failed rollout

### Requirement: Reference review is durable and independent

The system SHALL record whether a noncanonical BottleReference remains unreviewed or was reviewed by a moderator. Reviewing exact resolution and adding a displayed alias SHALL be separate decisions.

#### Scenario: Verify an exact reference

- **WHEN** a moderator confirms that a reference safely identifies its assigned Bottle
- **THEN** the reference remains active
- **AND** records the reviewer and review time

#### Scenario: Add an alias while quarantining resolution

- **WHEN** a moderator confirms that a generic string is a marketed alias but is unsafe for exact matching
- **THEN** the moderator can create the BottleAlias and quarantine the BottleReference independently

#### Scenario: Concurrent reference change

- **WHEN** a reference changes after a moderator loads its audit state
- **THEN** a review mutation fails instead of overwriting the newer state

### Requirement: Reference audit is deterministic and bounded

The system SHALL provide an administrator-only, read-only audit of active assigned noncanonical BottleReferences. Results SHALL be paginated and SHALL derive reproducible risk signals without an LLM decision.

#### Scenario: Inspect an unaudited reference

- **WHEN** an administrator requests the reference audit
- **THEN** each result identifies the reference, assigned Bottle, canonical name, assignment provenance, review state, and BottleGroup context
- **AND** includes counts of matching visible prices and reviews

#### Scenario: Report identity risk

- **WHEN** a reference has a parsed SMWS code, age, vintage year, release year, ABV, edition, or cask fact that conflicts with the assigned Bottle
- **THEN** the audit reports the conflicting facts as signals
- **AND** does not change the reference or Bottle

#### Scenario: Report generic-name ambiguity

- **WHEN** a reference omits distinguishing identity present on sibling Bottles or is an accepted-normalization prefix shared by multiple candidates
- **THEN** the audit reports the candidate Bottles and ambiguity signal

#### Scenario: Report redundant evidence

- **WHEN** equivalent reference evidence exists under accepted normalization
- **THEN** the audit reports the overlap without deleting either row

### Requirement: Quarantine stops future use without rewriting history

Quarantining a BottleReference SHALL exclude it from exact matching, reference embeddings, and Bottle search evidence. It SHALL queue the required indexes for refresh but SHALL NOT clear, retarget, or delete existing prices, reviews, or other consumers.

#### Scenario: Quarantine a risky generic reference

- **WHEN** a moderator quarantines an active assigned reference
- **THEN** future matching and search omit that reference
- **AND** existing consumer Bottle assignments remain unchanged

#### Scenario: Show quarantine impact

- **WHEN** a moderator reviews a reference before quarantine
- **THEN** the system shows the counts and identifiers needed to inspect affected consumers

### Requirement: Reference operations remain private and source owned

BottleReference list, audit, verification, quarantine, and assignment operations SHALL require administrator or moderator authority as appropriate. Public Bottle APIs SHALL NOT expose unresolved, quarantined, provenance, embedding, or review-state data.

#### Scenario: Public user requests references

- **WHEN** a user without required authority requests BottleReference data
- **THEN** the system rejects the request

#### Scenario: Moderator changes matching authority

- **WHEN** a moderator verifies, assigns, or quarantines a BottleReference
- **THEN** the BottleReference operation owns validation, locking, persistence, and index side effects
