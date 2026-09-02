## ADDED Requirements

### Requirement: Public Series identity

The system SHALL expose each active Bottle Series as a public catalog object with a computed Peated ID and canonical Series URL.

#### Scenario: Canonical Series URL

- **WHEN** a person opens an active Series by numeric ID, stale slug, or `S` Peated ID
- **THEN** the system redirects permanently to `/series/{id}-{current full-name slug}`

#### Scenario: Merged Series URL

- **WHEN** a person opens the ID or URL of a Series that was merged
- **THEN** the system redirects permanently to the surviving Series canonical URL

### Requirement: Series details contract

The system SHALL return Series-owned details separately from the lightweight Series summary embedded in Bottle responses.

#### Scenario: Load Series details

- **WHEN** a client requests an active or merged Series ID
- **THEN** the response identifies the active Series, its Peated ID, owning Brand, name, description, and Bottle count

### Requirement: Dedicated Series page

The system SHALL provide a responsive Series page that explains the Series and lists all active member Bottles.

#### Scenario: Series with Bottles

- **WHEN** a person opens a Series that contains Bottles
- **THEN** the page shows Brand context, Series identity, optional description, total Bottle count, sorting, pagination, and standard Bottle list rows

#### Scenario: Empty Series

- **WHEN** a person opens an active Series with no Bottles
- **THEN** the page shows the Series identity and a clear empty state without an inactive Bottle list shell

#### Scenario: Signed-in Library progress

- **WHEN** a signed-in member opens a Series page
- **THEN** the page shows how many cataloged Series Bottles are in their Library before the Bottle list
- **AND** the member can show all Bottles, Bottles in their Library, or Bottles not in their Library

#### Scenario: Signed-out Series page

- **WHEN** a signed-out person opens a Series page
- **THEN** the page shows the public Series facts without personal Library counts or filters

#### Scenario: Bottle without ratings

- **WHEN** a Bottle list row has no tasting ratings and no published review score
- **THEN** the row omits the empty ratings block

### Requirement: Bottle-to-Series navigation

The system SHALL make the assigned Series and other member Bottles discoverable from a Bottle page.

#### Scenario: Bottle has other Series members

- **WHEN** a Bottle belongs to a Series with at least one other Bottle
- **THEN** the overview shows the linked Series fact and up to three other member Bottles in a shared Bottle rail section with a link to the complete Series page

#### Scenario: Bottle is the only Series member

- **WHEN** a Bottle is the only active member of its Series
- **THEN** the overview shows the linked Series fact but omits the other-Bottles section

### Requirement: Series search discovery

The system SHALL return Bottle Series as a distinct global-search result type.

#### Scenario: Search by Series name

- **WHEN** a query matches an active Series name
- **THEN** search can return a Series result with its Brand, Bottle count, and canonical page link

#### Scenario: Search by Series Peated ID

- **WHEN** a query is an exact active or merged Series Peated ID
- **THEN** search returns the active Series as the exact match

### Requirement: Safe Series lifecycle

The system SHALL preserve public Series references across merges and prevent populated Series from being removed without a destination.

#### Scenario: Merge duplicate Series

- **WHEN** a moderator merges a source Series into an active destination Series owned by the same Brand
- **THEN** all member Bottles and BottleGroups reference the destination, the source becomes a redirect tombstone, and Series counts remain correct

#### Scenario: Delete populated Series

- **WHEN** a moderator tries to delete a Series that still contains Bottles
- **THEN** the system rejects the operation with a conflict and does not change any Bottle assignment

#### Scenario: Delete empty Series

- **WHEN** a moderator deletes a Series with no Bottle members
- **THEN** the system removes the active Series and records a destination-less tombstone
