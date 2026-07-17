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

#### Scenario: Resolve an exact Bottle alias

- **WHEN** an accepted alias owns an exact Bottle target
- **THEN** exact alias lookup returns that Bottle without requiring a release id
- **AND** a generic group alias does not select a representative Bottle

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

#### Scenario: Approve existing-match price evidence

- **WHEN** existing-match or correction approval receives a retained legacy Bottle/Release pair
- **THEN** it resolves one CatalogTarget using the deterministic promotion and parent-cardinality rules
- **AND** it reuses that target for both listing alias and observation identity in the approval transaction
- **AND** an exact result identifies its concrete Bottle while a generic result remains BottleGroup identity
- **AND** it does not select a representative Bottle for a generic result
- **AND** existing price assignment and proposal decision vocabulary remain compatibility data until their explicit cutovers

#### Scenario: Approve create-new price evidence before concrete creation cutover

- **WHEN** create-new approval still produces ungrouped legacy Bottle or BottleRelease rows
- **THEN** its listing alias and observation remain measured targetless compatibility
- **AND** they are not treated as compliant target-backed records
- **AND** the newly created concrete target is assigned only after the legacy creation and decision path is replaced

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
- **THEN** the compatibility adapter translates only supplied fields into a sparse exact patch for the mapped Bottle through the canonical update operation
- **AND** omitted fields remain unchanged and an explicit null clears the corresponding nullable canonical value
- **AND** it returns that Bottle's exact CatalogTarget replacement
- **AND** it does not update the retained BottleRelease row
- **AND** it performs no parallel direct alias, audit, or job writes
- **AND** successful compatibility telemetry records the legacy release id and replacement Bottle and target ids

#### Scenario: Legacy update cannot set an image URL

- **WHEN** a mapped legacy BottleRelease update supplies a non-null `imageUrl`
- **THEN** the compatibility adapter rejects the request without mutating the mapped Bottle or retained BottleRelease
- **AND** an explicitly supplied null `imageUrl` remains a canonical clear rather than an omitted field

#### Scenario: Update an unmapped legacy release

- **WHEN** a legacy BottleRelease update has no completed promotion mapping
- **THEN** the compatibility adapter rejects the request without creating, guessing, or mirroring catalog identity

#### Scenario: Retire a grouped exact Bottle

- **WHEN** a moderator retires a grouped exact Bottle
- **THEN** the moderator selects an explicit surviving Bottle and the system delegates to `mergeConcreteBottles`
- **AND** that operation owns exact-consumer consolidation, promotion-mapping repointing, aliases and tombstones, representative replacement, and singleton group retirement
- **AND** the system does not guess a representative, sibling, or generic target as the destination
- **AND** the promotion mapping remains live and points to the selected survivor without adding retired-promotion state

#### Scenario: Delete an ungrouped pre-migration Bottle

- **WHEN** the standard Bottle DELETE route receives an ungrouped pre-migration Bottle
- **THEN** it may perform the measured legacy compatibility purge
- **AND** the compatibility branch remains removable under task 9.7

#### Scenario: Delete a grouped concrete Bottle without a destination

- **WHEN** the standard Bottle DELETE route receives a grouped concrete Bottle
- **THEN** it rejects the request without mutation with an actionable merge-required result
- **AND** it does not create a destination-free canonical deletion path

#### Scenario: Legacy release repair excludes grouped Bottles

- **WHEN** legacy release-repair candidate discovery or either the preflight or locked apply read examines a Bottle
- **THEN** only a pre-migration Bottle with `groupId IS NULL` is eligible for that compatibility path
- **AND** a grouped Bottle is not offered, repaired, or deleted and must use an explicit exact Bottle merge
- **AND** task 9.7 removes the retained repair compatibility

#### Scenario: Delete through a completed legacy release mapping

- **WHEN** an administrator invokes BottleRelease DELETE for a release with a completed internally consistent promotion mapping
- **THEN** the compatibility adapter preserves its external admin authorization, path, input, and output contract
- **AND** it returns an actionable merge-required result naming the mapped Bottle and exact target
- **AND** it makes no mutation and does not delete the retained BottleRelease row
- **AND** it does not choose a representative, sibling, or generic target

#### Scenario: Delete through an invalid legacy release mapping

- **WHEN** BottleRelease DELETE finds a missing, incomplete, or inconsistent promotion mapping
- **THEN** it returns a conflict without mutating the mapped Bottle, target graph, or retained BottleRelease

#### Scenario: Remove unusable delete actions

- **WHEN** a Bottle or nested Bottling delete action can only produce the merge-required compatibility result
- **THEN** the web application removes or hides that action
- **AND** tasks 8.9 and 9.7 remove the remaining nested UI and compatibility surfaces

### Requirement: BottleRelease is retired after compatibility

The system SHALL stop producing BottleRelease records and SHALL remove release-specific routes, schemas, jobs, and foreign keys only after migration parity and compatibility gates pass.

#### Scenario: New write after write cutover

- **WHEN** any supported creation workflow saves a catalog product after the write cutover
- **THEN** it creates a Bottle and automatic group records
- **AND** it does not insert into `bottle_release`

#### Scenario: Cleanup gate is not satisfied

- **WHEN** target backfill has mismatches, legacy writes are still observed, or a referenced release lacks a mapping
- **THEN** destructive BottleRelease cleanup is blocked
