## ADDED Requirements

### Requirement: Entity aliases are other names shown to users

The system SHALL store a moderator-approved EntityAlias for one Entity. The
alias SHALL appear in search but SHALL NOT match new input to that Entity by
itself.

#### Scenario: Add an alias

- **WHEN** a moderator adds an alternate name to an Entity
- **THEN** the system stores the EntityAlias with the acting moderator and time
- **AND** refreshes Entity search data
- **AND** does not create an EntityReference

#### Scenario: Reuse the same alias on different Entities

- **WHEN** the same display name applies to two Entities
- **THEN** the system permits one EntityAlias for each Entity
- **AND** automatic matching does not select either Entity from that alias alone

### Requirement: Short name is part of the alias collection

Entity alias reads SHALL include the Entity's current `shortName`. The result
SHALL mark it as the short name. The alias delete route SHALL NOT delete it.

#### Scenario: Read an Entity with a short name

- **WHEN** an Entity has a non-empty `shortName`
- **THEN** its alias list includes that value and marks it as the short name

#### Scenario: Change the short name

- **WHEN** an authorized Entity update changes or clears `shortName`
- **THEN** later alias reads reflect the new current value
- **AND** the old value is no longer returned as the short name

#### Scenario: Delete the short-name alias

- **WHEN** a moderator tries to delete the short name through the alias route
- **THEN** the system rejects the alias mutation
- **AND** directs ownership to the Entity update boundary

### Requirement: Alias and reference changes are separate

Creating or deleting an EntityAlias SHALL NOT create, assign, unbind, or delete
an EntityReference. Entity merge SHALL move stored aliases to the survivor and
deduplicate equivalent aliases.

#### Scenario: Delete an alias that is also a reference string

- **WHEN** a moderator deletes a stored EntityAlias whose text is also an
  EntityReference
- **THEN** the EntityAlias is deleted
- **AND** the EntityReference remains unchanged

#### Scenario: Merge Entities with aliases

- **WHEN** one Entity merges into another
- **THEN** its stored aliases move to the surviving Entity
- **AND** equivalent aliases are stored once
