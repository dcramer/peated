## ADDED Requirements

### Requirement: Profile activity returns a union feed

The system SHALL provide a profile activity feed API that returns a discriminated union of activity entries for a target user.

#### Scenario: Tasting activity appears as a primary entry

- **WHEN** a visible profile has a recent tasting
- **THEN** the profile activity feed includes a `tasting` entry marked as primary activity with the serialized tasting payload and activity timestamp

#### Scenario: Collection-add activity appears as a secondary entry

- **WHEN** a visible profile has recent bottles added to a supported collection
- **THEN** the profile activity feed includes a `collection_add` entry marked as secondary activity with the destination collection, preview items, total item count, and activity timestamp

### Requirement: Profile visibility is preserved

The system MUST apply the same profile visibility rules to profile activity that existing profile collection and tasting views apply.

#### Scenario: Private profile is not visible

- **WHEN** a viewer cannot access a user's private profile
- **THEN** the profile activity feed request is rejected or hidden consistently with the existing private profile behavior

#### Scenario: Visible profile returns activity

- **WHEN** a viewer can access a user's profile
- **THEN** the profile activity feed may include that user's visible tasting and collection-add activity entries

### Requirement: Collection additions are grouped

The system SHALL aggregate collection-add activity by target user, destination collection, and a bounded time window before returning profile activity entries.

#### Scenario: Multiple additions to one collection are grouped

- **WHEN** a user adds multiple bottles or releases to the same supported collection within the grouping window
- **THEN** the profile activity feed returns one `collection_add` entry for that collection with preview items and `totalItems` equal to the number of grouped additions

#### Scenario: Additions to different collections are separate

- **WHEN** a user adds bottles to different supported collections
- **THEN** the profile activity feed returns separate `collection_add` entries for each destination collection

#### Scenario: Existing duplicate add attempts do not create new activity

- **WHEN** a user attempts to add a bottle or release that already exists in the destination collection
- **THEN** the duplicate attempt does not increase the grouped activity item count

### Requirement: Secondary activity is throttled

The system SHALL compose profile activity so secondary collection-add entries do not overwhelm primary tasting entries.

#### Scenario: Primary entries are prioritized

- **WHEN** a profile has both tasting entries and many collection-add groups
- **THEN** the first page of the profile activity feed prioritizes tasting entries and includes only a capped number of secondary collection-add entries

#### Scenario: Secondary entries fill an otherwise empty profile

- **WHEN** a profile has collection-add activity but no tasting activity
- **THEN** the profile activity feed shows grouped collection-add entries instead of an empty activity state

### Requirement: Collection-add entries are linkable and compact

The system SHALL render collection-add profile activity as compact entries with linkable destination and item context.

#### Scenario: Reserved collection entry links to collection tab

- **WHEN** a collection-add activity entry targets Library or Favorites
- **THEN** the rendered entry links the destination collection to the user's corresponding profile collection tab

#### Scenario: Preview item links to catalog page

- **WHEN** a collection-add activity entry previews a bottle or release
- **THEN** each previewed item links to its bottle or release detail page

#### Scenario: Multi-item entry shows hidden count

- **WHEN** a collection-add activity entry contains more items than the preview limit
- **THEN** the rendered entry displays the preview items and a remaining item count

### Requirement: Existing tasting rendering remains compatible

The system MUST continue rendering tasting activity normally after the profile Activity tab switches to the union feed.

#### Scenario: Existing tasting card behavior is preserved

- **WHEN** the profile activity feed includes a `tasting` entry
- **THEN** the web UI renders it with the existing tasting list item behavior and supported interactions
