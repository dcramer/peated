## MODIFIED Requirements

### Requirement: One Entity kind

The system SHALL keep one Entity record for each whisky identity or owning
company. Each Entity SHALL have exactly one kind from Brand, Distillery,
Bottler, or Company.

#### Scenario: Distillery also appears as a Brand

- **WHEN** Lagavulin is the Brand and Distiller for a Bottle
- **THEN** both Bottle links reference the same Lagavulin Entity whose kind is
  `distillery`

#### Scenario: Owning company has no Bottles

- **WHEN** Diageo owns Lagavulin but is not named on a Bottle
- **THEN** Diageo remains an Entity whose kind is `company`

### Requirement: Clear API names

The system SHALL use dedicated Brand, Distillery, Bottler, and Company API
collections for what an Entity is. Bottle APIs SHALL use Brand, Bottler, and
Distiller as Bottle field names. The system SHALL keep the generic Entity API
for cross-kind selectors, creation, updates, and other shared Entity
operations. It MUST NOT add a stored Entity role, use the generic collection
for kind browse pages, or use `type` for both meanings.

#### Scenario: List one Entity kind

- **WHEN** a caller lists `/bottlers`
- **THEN** every result has kind `bottler` and the caller does not pass a kind
  filter

#### Scenario: Browse one Entity kind

- **WHEN** a caller needs a collection of one Entity kind
- **THEN** it uses that kind's dedicated endpoint instead of `GET /entities`

#### Scenario: Select across Entity kinds

- **WHEN** a Bottle or ownership field needs to select any Entity
- **THEN** `GET /entities` searches all four kinds and returns each result's
  kind

#### Scenario: Create an Entity

- **WHEN** a caller creates a Bottler through `POST /entities`
- **THEN** the caller passes kind `bottler` and the server stores that kind

#### Scenario: Update an Entity

- **WHEN** a moderator changes an Entity's kind or other shared fields
- **THEN** it uses the shared Entity update endpoint

#### Scenario: List Companies

- **WHEN** a caller lists `/companies`
- **THEN** the system returns Companies even when they have no Bottles

#### Scenario: Search for a Bottler

- **WHEN** a Bottle form searches for an Entity for its Bottler field
- **THEN** the generic Entity selector considers every Entity kind and does not
  require or infer a Bottler role

#### Scenario: Search one Entity kind

- **WHEN** a caller searches the Company scope
- **THEN** every Entity result has kind `company`, regardless of its Bottle
  relationships

#### Scenario: Search all Entities for a Bottle field

- **WHEN** a Bottle form searches its Brand, Bottler, or Distiller field
- **THEN** it uses the generic Entity selector collection and may return any
  Entity kind

## ADDED Requirements

### Requirement: Legacy Blender reclassification

The system MUST reclassify every Entity whose stored kind is `blender` as a
Bottler before it removes `blender` from the database enum. It MUST preserve
Entity ids and all Bottle relationships.

#### Scenario: Reclassify a Blender

- **WHEN** the migration processes a Compass Box Entity whose kind is
  `blender`
- **THEN** the same Entity id has kind `bottler` and its Brand, Bottler, and
  Distiller Bottle links are unchanged

#### Scenario: Keep Company ownership specific

- **WHEN** a legacy Blender is not an owning parent organization such as Diageo
- **THEN** the migration does not use `company` as its fallback kind
