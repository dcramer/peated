## ADDED Requirements

### Requirement: Main activity returns a mixed feed

The system SHALL provide a main activity feed API that returns a discriminated union of activity entries for global, friends, and local feed pages.

#### Scenario: Tasting entries remain primary activity

- **WHEN** a visible user has recent tasting activity matching the requested feed filter
- **THEN** the main activity feed includes `tasting` entries marked as primary activity with serialized tasting payloads

#### Scenario: Collection-add entries appear as secondary activity

- **WHEN** a visible user has recent additions to a supported collection matching the requested feed filter
- **THEN** the main activity feed includes `collection_add` entries marked as secondary activity with actor, collection, preview items, total item count, and activity timestamps

### Requirement: Main activity applies feed visibility filters

The system MUST apply the same user visibility and friend-filter rules to main activity source rows that the existing tasting feed applies.

#### Scenario: Anonymous global feed hides private users

- **WHEN** an anonymous viewer requests the global activity feed
- **THEN** the feed excludes tasting and collection-add activity owned by private users

#### Scenario: Authenticated global feed includes visible private users

- **WHEN** an authenticated viewer requests the global activity feed
- **THEN** the feed may include activity from the viewer and followed private users while excluding private users the viewer cannot see

#### Scenario: Friends feed requires authentication

- **WHEN** an anonymous viewer requests the friends activity feed
- **THEN** the request is rejected as unauthorized

#### Scenario: Friends feed includes followed users

- **WHEN** an authenticated viewer requests the friends activity feed
- **THEN** the feed includes tasting and collection-add activity owned by followed users and excludes non-followed users

### Requirement: Main collection additions are grouped

The system SHALL aggregate main-feed collection-add activity by actor, destination collection, and bounded time window before returning activity entries.

#### Scenario: Multiple additions to one collection are grouped

- **WHEN** a visible user adds multiple bottles or releases to the same supported collection within the grouping window
- **THEN** the main activity feed returns one `collection_add` entry for that actor and collection with preview items and `totalItems` equal to the grouped additions

#### Scenario: Additions from different actors are separate

- **WHEN** different visible users add bottles to collections within the same time window
- **THEN** the main activity feed returns separate `collection_add` entries per actor and destination collection

### Requirement: Secondary activity is throttled on main feeds

The system SHALL compose main activity so secondary collection-add entries do not overwhelm primary tasting entries.

#### Scenario: Primary entries are prioritized

- **WHEN** the main feed has both tasting entries and many collection-add groups
- **THEN** the returned page prioritizes tasting entries and includes only a capped number of secondary collection-add entries

#### Scenario: Secondary entries fill collection-only feeds

- **WHEN** the main feed has collection-add activity but no tasting activity
- **THEN** the feed shows grouped collection-add entries instead of an empty activity state

### Requirement: Main activity renders collection-add entries

The web app MUST render main activity entries using the same mixed activity presentation as profile activity.

#### Scenario: Main activity page shows grouped collection addition

- **WHEN** the main activity API returns a `collection_add` entry
- **THEN** the web feed renders a compact collection-add row with actor link, destination collection link when available, preview item links, and remaining item count

#### Scenario: Main activity page preserves tasting behavior

- **WHEN** the main activity API returns a `tasting` entry
- **THEN** the web feed renders it with the existing tasting list item behavior and supported interactions
