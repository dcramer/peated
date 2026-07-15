## ADDED Requirements

### Requirement: Every marketed release is a Bottle

The system SHALL represent every concrete marketed release as a Bottle with its own stable `bottleId`, including catalog entries previously represented as a parent Bottle plus BottleRelease.

#### Scenario: Create an independent Bottle

- **WHEN** an authenticated user submits stable expression fields and any exact edition, year, ABV, or cask fields through Add Bottle
- **THEN** the system creates one concrete Bottle and returns its `bottleId`

#### Scenario: Create another release

- **WHEN** a user starts “add another release” from an existing Bottle and submits different exact release fields
- **THEN** the system creates another Bottle rather than a BottleRelease
- **AND** both Bottles remain distinct exact catalog entries

### Requirement: Concrete fields have one owner

The system SHALL store edition, release year, vintage year, release-specific age, ABV, single-cask, cask-strength, cask-size, cask-type, and cask-fill fields only on the concrete Bottle.

#### Scenario: Save exact attributes

- **WHEN** a Bottle is created or edited with exact release attributes
- **THEN** those attributes are persisted on that Bottle
- **AND** no corresponding child-release record is created

### Requirement: Bottle creation is one workflow

The web application SHALL provide one Add Bottle workflow for both ordinary and precisely identified products and SHALL NOT require the user to choose between Bottle and Bottling creation.

#### Scenario: Add a precisely identified product

- **WHEN** a user opens Add Bottle with edition, year, ABV, or cask information
- **THEN** the same Bottle form accepts those values
- **AND** the submit action is labeled as creating a Bottle

#### Scenario: Add from an existing group member

- **WHEN** a user chooses to add another release from a Bottle page
- **THEN** the form reuses the existing group identity and pre-fills its stable fields
- **AND** only a new concrete Bottle is created

### Requirement: Bottle search and details are first class

The system SHALL index, search, serialize, route, collect, price, review, and display promoted and newly created Bottles in the same way as any other Bottle.

#### Scenario: Search a promoted legacy release

- **WHEN** a legacy BottleRelease has been promoted and its name or alias is searched
- **THEN** search returns the promoted Bottle with its exact `bottleId`

#### Scenario: Open an exact Bottle

- **WHEN** a user opens a promoted or newly created Bottle URL
- **THEN** the page displays its exact attributes, images, activity, prices, and group relationship without requiring a release id

### Requirement: Legacy bottling identity remains reachable

The system SHALL retain an auditable mapping from every migrated BottleRelease to its promoted Bottle and SHALL preserve old references during the compatibility period.

#### Scenario: Open a legacy nested bottling URL

- **WHEN** a request addresses a migrated `/bottles/:parentId/bottlings/:releaseId` URL
- **THEN** the system permanently redirects to the promoted Bottle URL

#### Scenario: Resolve a legacy API reference

- **WHEN** a compatibility API receives a known legacy `releaseId`
- **THEN** it resolves the mapped Bottle without re-creating or duplicating catalog data

### Requirement: BottleRelease is retired after compatibility

The system SHALL stop producing BottleRelease records and SHALL remove release-specific routes, schemas, jobs, and foreign keys only after migration parity and compatibility gates pass.

#### Scenario: New write after write cutover

- **WHEN** any supported creation workflow saves a catalog product after the write cutover
- **THEN** it creates a Bottle and automatic group records
- **AND** it does not insert into `bottle_release`

#### Scenario: Cleanup gate is not satisfied

- **WHEN** target backfill has mismatches, legacy writes are still observed, or a referenced release lacks a mapping
- **THEN** destructive BottleRelease cleanup is blocked
