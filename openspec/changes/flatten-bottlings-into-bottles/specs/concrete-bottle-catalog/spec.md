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

#### Scenario: Create through the legacy BottleRelease route

- **WHEN** an authenticated, terms-accepted caller submits the legacy BottleRelease create input with an active source Bottle
- **THEN** the system validates the exact fields through canonical concrete Bottle creation
- **AND** it creates the Bottle in the source Bottle's trusted group without inserting a BottleRelease
- **AND** it emits measured compatibility-write context
- **AND** it returns the versioned exact CatalogTarget replacement without fabricating or overloading a release id

#### Scenario: Legacy create cannot translate an image URL

- **WHEN** the legacy BottleRelease create input contains a non-null `imageUrl`
- **THEN** the compatibility adapter rejects the request instead of ignoring the image or bypassing the canonical upload boundary

#### Scenario: Legacy create receives retired parent context

- **WHEN** the legacy BottleRelease create input names a missing or retired Bottle
- **THEN** the compatibility adapter fails explicitly
- **AND** it does not choose a representative or another group member as exact identity

#### Scenario: Update a promoted legacy release

- **WHEN** a moderator updates a legacy BottleRelease with a completed promotion mapping
- **THEN** the compatibility adapter applies only the supplied exact fields to the mapped Bottle through the canonical update service
- **AND** it returns that Bottle's exact CatalogTarget replacement
- **AND** it does not update the retained BottleRelease row

#### Scenario: Update an unmapped legacy release

- **WHEN** a legacy BottleRelease update has no completed promotion mapping
- **THEN** the compatibility adapter rejects the request without creating, guessing, or mirroring catalog identity

#### Scenario: Delete through a legacy release reference

- **WHEN** BottleRelease delete is converted to a compatibility adapter
- **THEN** it delegates only to canonical concrete Bottle deletion whose permanent promotion-mapping, group membership, representative, target, and tombstone behavior is defined and validated
- **AND** it does not reuse the superseded direct BottleRelease or legacy Bottle deletion implementation

### Requirement: BottleRelease is retired after compatibility

The system SHALL stop producing BottleRelease records and SHALL remove release-specific routes, schemas, jobs, and foreign keys only after migration parity and compatibility gates pass.

#### Scenario: New write after write cutover

- **WHEN** any supported creation workflow saves a catalog product after the write cutover
- **THEN** it creates a Bottle and automatic group records
- **AND** it does not insert into `bottle_release`

#### Scenario: Cleanup gate is not satisfied

- **WHEN** target backfill has mismatches, legacy writes are still observed, or a referenced release lacks a mapping
- **THEN** destructive BottleRelease cleanup is blocked
