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

### Requirement: Reference operations remain private and source owned

BottleReference list and assignment operations SHALL require moderator authority. Public Bottle APIs SHALL NOT expose unresolved, ignored, provenance, or embedding data.

#### Scenario: Public user requests references

- **WHEN** a user without required authority requests BottleReference data
- **THEN** the system rejects the request

#### Scenario: Moderator assigns matching authority

- **WHEN** a moderator assigns a BottleReference
- **THEN** the BottleReference operation owns validation, locking, persistence, and index side effects
