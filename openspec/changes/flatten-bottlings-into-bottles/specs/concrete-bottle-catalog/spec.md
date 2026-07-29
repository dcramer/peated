## ADDED Requirements

### Requirement: Every marketed release is a Bottle

The system SHALL represent every concrete, general, or unversioned marketed
catalog entry as a Bottle with its own stable `bottleId`.

#### Scenario: Create an independent Bottle

- **WHEN** a user submits stable identity and optional edition, year, ABV, age,
  or cask fields
- **THEN** the system creates one independently complete Bottle
- **AND** it creates no BottleRelease

#### Scenario: Create another release

- **WHEN** a user submits a prefilled “add another release” draft
- **THEN** the system creates another Bottle
- **AND** the source Bottle remains unchanged and is only prefill evidence

### Requirement: Concrete fields have one owner

The system SHALL store edition, release year, vintage year, effective stated
age, ABV, flags, cask traits, exact content, and exact statistics on Bottle.

#### Scenario: Render an exact Bottle

- **WHEN** a Bottle is loaded by an API, page, search result, or worker
- **THEN** all information needed for correct identity and rendering is present
  on the Bottle
- **AND** no BottleGroup or BottleRelease hydration is required

### Requirement: Bottle creation is one workflow

The web application SHALL provide one Add Bottle workflow and SHALL NOT ask the
user to choose between Bottle and Bottling creation.

#### Scenario: Add a precisely identified product

- **WHEN** the user supplies edition, year, ABV, age, or cask information
- **THEN** the standard Bottle form accepts it
- **AND** submission creates a Bottle

#### Scenario: Add from an existing Bottle

- **WHEN** the user chooses “add another release”
- **THEN** the form pre-fills a complete draft
- **AND** submits the same independent Bottle creation operation

### Requirement: Bottle search and details are first class

The system SHALL index, search, serialize, route, collect, price, review, and
display promoted and newly created Bottles in the same way as any other Bottle.

#### Scenario: Search a promoted release

- **WHEN** a promoted legacy release name or exact alias is searched
- **THEN** search returns the promoted Bottle

#### Scenario: Open a Bottle

- **WHEN** a user opens a promoted, general, or newly created Bottle
- **THEN** the page displays Bottle-owned identity, activity, prices, images,
  and an optional related-release link

### Requirement: Legacy bottling identity remains reachable

The system SHALL retain an auditable mapping from every migrated BottleRelease
to its promoted Bottle.

#### Scenario: Open a nested bottling URL

- **WHEN** a legacy nested BottleRelease URL is requested
- **THEN** it permanently redirects to the promoted Bottle URL

#### Scenario: Open a legacy family URL

- **WHEN** a legacy family URL is requested
- **THEN** it redirects to `/bottles/:activeMemberBottleId/releases`
- **AND** the active member is only a route locator

#### Scenario: Use a retained compatibility API

- **WHEN** a compatibility API receives a known legacy release id
- **THEN** it resolves the mapped Bottle and delegates to canonical Bottle logic
- **AND** it emits bounded compatibility telemetry

### Requirement: Bottle retirement requires an explicit Bottle destination

The system SHALL merge duplicate Bottles only through one canonical operation
with an explicitly selected surviving Bottle.

#### Scenario: Merge duplicate Bottles

- **WHEN** a moderator selects a source and destination Bottle
- **THEN** consumer references, aliases, mappings, and tombstones converge on
  the destination
- **AND** the system does not use BottleGroup as the retirement destination

### Requirement: BottleRelease cleanup is separately approved

The system SHALL stop producing BottleRelease rows before removing legacy
tables, columns, routes, schemas, jobs, and compatibility branches.

#### Scenario: New write after application cutover

- **WHEN** any supported workflow creates catalog identity
- **THEN** it creates a Bottle and automatic group
- **AND** it does not insert BottleRelease

#### Scenario: Cleanup gate is not satisfied

- **WHEN** a retained preflight, migration, direct-reference validation, backup,
  or explicit approval is missing
- **THEN** destructive BottleRelease cleanup is blocked
