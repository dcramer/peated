## ADDED Requirements

### Requirement: Entity references support automatic matching

An EntityReference SHALL link one accepted name to one Entity. Only assigned
EntityReferences and Entity name fields SHALL match input to an Entity without
a classifier.

#### Scenario: Resolve an assigned reference

- **WHEN** Entity creation or Bottle relationship resolution receives an exact
  assigned EntityReference
- **THEN** the system reuses that Entity

#### Scenario: Encounter an unassigned reference

- **WHEN** an EntityReference has no Entity assignment
- **THEN** the system preserves the reference
- **AND** does not resolve an Entity from it

#### Scenario: Encounter an alias

- **WHEN** input equals only an EntityAlias
- **THEN** exact Entity reuse does not select that Entity from the alias alone

### Requirement: Entity names have references

Entity create and update SHALL keep references for the name, current short
name, and the name without a leading “The.” The update SHALL fail if one of
these names belongs to another Entity.

#### Scenario: Create an Entity with a short name

- **WHEN** an Entity is created with a name and short name
- **THEN** the system assigns references for both names to the Entity

#### Scenario: Change Entity names

- **WHEN** a moderator changes an Entity name or short name
- **THEN** the system updates the Entity's references
- **AND** rejects a name already assigned to another Entity

### Requirement: The migration keeps existing matches

The migration SHALL preserve every existing EntityAlias row as an
EntityReference with the same name, Entity assignment, and creation time. It
SHALL NOT copy those rows into the new EntityAlias table.

#### Scenario: Apply the storage cutover

- **WHEN** the generated migration runs
- **THEN** existing exact references keep their assignment and uniqueness
- **AND** display EntityAlias storage starts empty
