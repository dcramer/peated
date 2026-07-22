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
- **AND** the source Bottle supplies prefill data only
- **AND** the new Bottle starts in its own singleton BottleGroup for later
  automatic grouping

### Requirement: Concrete fields have one owner

The system SHALL store edition, release year, vintage year, release-specific age, ABV, single-cask, cask-strength, cask-size, cask-type, and cask-fill fields only on the concrete Bottle.

#### Scenario: Save exact attributes

- **WHEN** a Bottle is created or edited with exact release attributes
- **THEN** those attributes are persisted on that Bottle
- **AND** no corresponding child-release record is created

### Requirement: Correction age ownership is migration-safe

The system SHALL interpret sparse correction-proposal `statedAge` values using
the staged `statedAgeScope` contract until historical proposals are drained or
migrated, and SHALL make exact Bottle ownership the only live contract after
that transition.

#### Scenario: Apply a marked exact age correction

- **WHEN** a correction proposal supplies a non-null `statedAge` with
  `statedAgeScope: exact`
- **THEN** approval applies the age only to the selected Bottle
- **AND** sibling Bottles and the BottleGroup shared age remain unchanged

#### Scenario: Apply a historical unmarked age correction

- **WHEN** a historical correction proposal supplies a non-null `statedAge`
  without `statedAgeScope`
- **THEN** approval treats the age as shared BottleGroup intent
- **AND** the canonical shared-update transaction rematerializes every member
  Bottle according to the effective-age fan-out rules

#### Scenario: Preserve sparse null age

- **WHEN** a marked or unmarked correction proposal supplies a null
  `statedAge`
- **THEN** approval treats the field as an unknown sparse value
- **AND** it changes neither the selected Bottle age nor the BottleGroup shared
  age

#### Scenario: Remove the historical ownership fallback

- **WHEN** pending historical correction proposals have been drained or
  migrated under task 9.7
- **THEN** the system removes `statedAgeScope` and the unmarked shared-age
  fallback together
- **AND** every subsequent non-null correction `statedAge` is exact intent for
  the selected Bottle by default

### Requirement: Bottle creation is one workflow

The web application SHALL provide one Add Bottle workflow for both ordinary and precisely identified products and SHALL NOT require the user to choose between Bottle and Bottling creation.

#### Scenario: Add a precisely identified product

- **WHEN** a user opens Add Bottle with edition, year, ABV, or cask information
- **THEN** the same Bottle form accepts those values
- **AND** the submit action is labeled as creating a Bottle

#### Scenario: Add from an existing Bottle

- **WHEN** a user chooses to add another release from a Bottle page
- **THEN** the form pre-fills a complete draft from the selected Bottle's durable
  fields
- **AND** it submits the standard independent Bottle creation mutation
- **AND** the new Bottle receives a singleton group rather than reusing the
  selected Bottle's group
- **AND** later grouping is automatic and outside the manual workflow

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

- **WHEN** a moderator approves an existing-match proposal using a selected
  CatalogTarget id
- **THEN** an exact target derives the concrete Bottle's `(bottleId, null)`
  retained projection
- **AND** a generic target is accepted only when it is the proposal's suggested
  target and its retained projection still validates to that target
- **AND** the StorePrice, listing alias, observation, proposal, and that
  proposal's latest attempt receive the same target and retained projection in
  one approval transaction
- **AND** generic approval does not select a representative or another member
  Bottle
- **AND** retained Bottle/Release pairs remain compatibility evidence rather
  than approval input or target-selection authority

#### Scenario: Apply an exact same-Bottle correction repair

- **WHEN** a moderator applies a sparse Bottle repair from a correction proposal
- **THEN** the proposal's current and suggested target ids must both be non-null
  active exact targets for the same concrete Bottle
- **AND** approval locks and revalidates that exact target identity before
  composing the canonical Bottle update with proposal approval
- **AND** retained current and suggested pairs cannot select or substitute a
  different concrete Bottle

#### Scenario: Translate bottle-only price evidence

- **WHEN** create-new approval receives bottle-only legacy creation input
- **THEN** Bottle input supplies the independent Bottle's stable identity,
  including shared stated age
- **AND** Bottle release-shaped fields supply exact input with exact stated age
  set to null
- **AND** it creates one independent concrete Bottle, singleton group, and exact
  target
- **AND** it creates no BottleRelease

#### Scenario: Translate combined price evidence

- **WHEN** create-new approval receives combined Bottle and Release input
- **THEN** Bottle input supplies the independent Bottle's stable identity
- **AND** Release input takes exact-field precedence, including a stated age
  that remains authoritative when null
- **AND** other nullable exact fields use Bottle input as a nullish fallback
- **AND** Bottle `descriptionSrc` is retained only when Bottle description wins
- **AND** it creates one independent Bottle, singleton group, and exact target
- **AND** it creates no BottleRelease

#### Scenario: Approve another release from price evidence

- **WHEN** create-new approval receives release-only input and a trusted source Bottle
- **THEN** it creates one concrete Bottle in the source Bottle's group and one exact target
- **AND** Release input supplies the concrete Bottle's exact fields
- **AND** an active exact duplicate may be reused only when its canonical
  `fullName` exactly matches the requested canonical `fullName` or its
  structurally parsed SMWS code exactly matches, its exact target is active,
  and it belongs to that same group
- **AND** a cross-group exact duplicate aborts the approval
- **AND** a collision found only through an arbitrary or ignored alias, fuzzy
  name similarity, or fuzzy or substring-only SMWS matching is not reusable
  exact identity

#### Scenario: Reject an untranslatable create-new image URL

- **WHEN** any otherwise valid bottle-only, release-only, or combined legacy
  create-new payload supplies a non-null Bottle or Release `imageUrl`
- **THEN** the compatibility route rejects the input before committing catalog
  or approval mutations
- **AND** it does not ignore the image URL or write it around the canonical
  upload boundary
- **AND** accepting the retained payload shape does not promise that every
  legacy field can be translated or preserved

#### Scenario: Persist one concrete approval identity

- **WHEN** create-new approval creates or safely reuses a concrete Bottle
- **THEN** its listing alias, observation, StorePrice, approved proposal, and
  that proposal's own latest attempt share the exact target
- **AND** the approved proposal and its own latest-attempt current and suggested
  retained projections are `(bottleId, null)`
- **AND** no cross-volume sibling proposal is retargeted
- **AND** an incoming decision log receives the same target and projection only
  when the approval emits an initial source decision
- **AND** a prior source decision remains immutable

#### Scenario: Preserve the create-new compatibility response

- **WHEN** a retained caller successfully approves a translatable bottle-only,
  release-only, or combined create-new legacy payload
- **THEN** the route returns the independently complete concrete Bottle and `release: null`
- **AND** no BottleRelease writer or finalizer runs

#### Scenario: Measure create-new compatibility-route usage

- **WHEN** an authorized schema-valid request reaches the retained create-new
  price-approval compatibility handler
- **THEN** structured compatibility telemetry records the caller, operation,
  legacy payload discriminator, and handler success or rejection outcome
- **AND** a successful event includes the replacement Bottle and exact target
  identifiers without recording the raw payload
- **AND** task 9.7 removes the route input/output adapter only after Section 8
  callers have migrated and observed compatibility-handler traffic is zero

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
