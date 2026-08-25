## ADDED Requirements

### Requirement: Bottles and entities have permanent Peated IDs

The system SHALL expose a Peated ID for every bottle and entity by combining its object prefix with its existing positive numeric ID and adding leading zeroes until the numeric part has at least six digits.

#### Scenario: Bottle Peated ID

- **WHEN** a bottle has numeric ID `123`
- **THEN** its Peated ID is `B000123`

#### Scenario: Entity Peated ID

- **WHEN** an entity has numeric ID `123`
- **THEN** its Peated ID is `E000123`

#### Scenario: Matching numeric portions remain distinct

- **WHEN** a bottle and an entity both have numeric ID `123`
- **THEN** `B000123` identifies the bottle and `E000123` identifies the entity without ambiguity

### Requirement: Peated IDs have permanent short URLs

The system SHALL resolve bottle and entity Peated IDs from root-level URLs while preserving the Peated ID in the public URL.

#### Scenario: Bottle short URL

- **WHEN** a visitor opens `/B000123`
- **THEN** the system displays bottle `123` using the normal bottle page and layout

#### Scenario: Entity short URL

- **WHEN** a visitor opens `/E000123`
- **THEN** the system displays entity `123` using the normal entity page and layout

#### Scenario: Lowercase URL

- **WHEN** a visitor opens `/b123`
- **THEN** the system permanently redirects to `/B000123`

#### Scenario: Unpadded URL

- **WHEN** a visitor opens `/B123`
- **THEN** the system permanently redirects to `/B000123`

#### Scenario: Unsupported root path

- **WHEN** a root path does not exactly match a supported Peated ID
- **THEN** Peated ID routing does not claim that path

### Requirement: Existing detail URLs remain compatible

The system SHALL preserve existing numeric bottle and entity detail links by redirecting them to Peated ID URLs.

#### Scenario: Existing bottle URL

- **WHEN** a visitor opens `/bottles/123`
- **THEN** the system permanently redirects to `/B000123`

#### Scenario: Existing entity URL

- **WHEN** a visitor opens `/entities/123`
- **THEN** the system permanently redirects to `/E000123`

#### Scenario: Nested route

- **WHEN** a visitor opens a nested bottle or entity workflow route
- **THEN** the route retains its existing resource-specific path

### Requirement: API responses expose Peated IDs

The system SHALL include a readonly `peatedId` string in serialized bottle and entity responses while retaining the existing numeric `id`.

#### Scenario: Serialized bottle

- **WHEN** bottle `123` is returned by the API
- **THEN** the response includes `id: 123` and `peatedId: "B000123"`

#### Scenario: Serialized entity

- **WHEN** entity `123` is returned by the API
- **THEN** the response includes `id: 123` and `peatedId: "E000123"`

### Requirement: Global search recognizes Peated IDs

The system SHALL recognize an exact Peated ID query case-insensitively and return the identified object when its result type is included.

#### Scenario: Search for bottle Peated ID

- **WHEN** global search receives `B000123` or `B123` and bottle results are included
- **THEN** bottle `123` is returned as the exact result

#### Scenario: Search for lowercase entity Peated ID

- **WHEN** global search receives `e123` and entity results are included
- **THEN** entity `123` is returned as the exact result

#### Scenario: Excluded result type

- **WHEN** global search receives `B000123` and bottle results are excluded
- **THEN** bottle `123` is not returned

### Requirement: Peated IDs are visible and copyable

The system SHALL show the Peated ID on bottle and entity detail pages and provide a way to copy its permanent URL.

#### Scenario: Bottle header

- **WHEN** a visitor views a bottle page
- **THEN** the header shows its Peated ID near the bottle name

#### Scenario: Copy Peated ID link

- **WHEN** a visitor activates the Peated ID copy action
- **THEN** the full permanent Peated ID URL is copied

### Requirement: Merged object IDs continue to resolve

The system SHALL resolve a Peated ID for a merged bottle or entity through the existing tombstone to the surviving object.

#### Scenario: Merged bottle

- **WHEN** `B000123` identifies a bottle that was merged into bottle `456`
- **THEN** the visitor is redirected to `B000456`

#### Scenario: Merged entity

- **WHEN** `E000123` identifies an entity that was merged into entity `456`
- **THEN** the visitor is redirected to `E000456`
