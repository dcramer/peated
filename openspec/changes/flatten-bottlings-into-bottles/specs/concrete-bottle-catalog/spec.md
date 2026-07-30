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

### Requirement: Legacy bottling identity is retired from public interfaces

The system SHALL retain an auditable mapping from every migrated BottleRelease
to its promoted Bottle through migration validation, then remove that mapping
with separately approved cleanup while exposing only canonical Bottle
interfaces.

#### Scenario: Request a retired nested bottling URL

- **WHEN** a legacy nested BottleRelease URL is requested
- **THEN** no compatibility route handles the request

#### Scenario: Request a retired family URL

- **WHEN** a legacy family URL is requested
- **THEN** no compatibility route handles the request

#### Scenario: Request a retired BottleRelease API

- **WHEN** a client requests any BottleRelease operation
- **THEN** the operation is absent from oRPC and OpenAPI
- **AND** canonical Bottle operations remain available

### Requirement: Bottle retirement requires an explicit Bottle destination

The system SHALL merge duplicate Bottles only through one canonical operation
with an explicitly selected surviving Bottle.

#### Scenario: Merge duplicate Bottles

- **WHEN** a moderator selects a source and destination Bottle
- **THEN** consumer references, aliases, mappings, and tombstones converge on
  the destination
- **AND** the system does not use BottleGroup as the retirement destination

### Requirement: BottleRelease cleanup is separately approved

The system SHALL stop producing BottleRelease rows before removing public
routes and schemas. It SHALL retire migration-only jobs and retained audit
support separately from the destructive removal of legacy tables and columns.

The system SHALL deploy an application revision that no longer models or
accesses those legacy database objects before a later migration physically
removes them. Historical change records MAY retain their original object type
as inert audit data but SHALL NOT appear in current change feeds.

#### Scenario: New write after application cutover

- **WHEN** any supported workflow creates catalog identity
- **THEN** it creates a Bottle and automatic group
- **AND** it does not insert BottleRelease

#### Scenario: Cleanup gate is not satisfied

- **WHEN** a retained preflight, migration, direct-reference validation, backup,
  or explicit approval is missing
- **THEN** destructive BottleRelease cleanup is blocked

#### Scenario: Runtime detachment deploy

- **WHEN** the pre-drop application revision is deployed
- **THEN** normal API and worker paths do not model, read, or write
  BottleRelease tables or consumer columns
- **AND** it may remove legacy foreign-key constraints required to keep
  canonical Bottle operations functional
- **AND** no table or column cleanup DDL is generated or auto-applied by that
  revision
- **AND** the read-only pre-drop audit can still inspect the physical legacy
  objects

#### Scenario: Physical cleanup deploy

- **WHEN** the detached revision is fully deployed and destructive cleanup is
  approved
- **THEN** the generated migration removes BottleRelease tables, promotion and
  repair tables, consumer release columns, and migration-only enum types
- **AND** historical change records may keep their inert object type

#### Scenario: Reversible support cleanup

- **WHEN** the detached revision is fully deployed and required migration audit
  evidence has been retained
- **THEN** migration-only CLI, schemas, libraries, and test fixtures may be
  removed
- **AND** no table or column cleanup DDL is generated
- **AND** the physical legacy objects remain available for a later separately
  approved cleanup
