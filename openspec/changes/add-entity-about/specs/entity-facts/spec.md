## ADDED Requirements

### Requirement: One About document per Entity

The system SHALL store each Entity's sources, citations, history events, site
facts, and About sections in one About document. Every read and write SHALL
check the document against the About schema in code. Each event, site fact,
and section SHALL record whether a person or the pipeline wrote it. A write SHALL include
the document version it read, and the system SHALL reject a write based on an
older version.

#### Scenario: Two writers

- **WHEN** the pipeline and a moderator both read version 4 and the moderator
  saves first
- **THEN** the pipeline's write is rejected and it retries from version 5

#### Scenario: Invalid document

- **WHEN** a write contains a site fact that is not in the field list
- **THEN** the write is rejected and the stored document is unchanged

### Requirement: About schema changes stay backward compatible

Changes to the About document schema SHALL be rare. A change SHALL add only
optional fields, and SHALL NOT rename or remove a field or change what a field
means. Every stored document SHALL still parse after a change. A change that
cannot meet this SHALL bump the schema version and ship an upgrade that runs
when a document is read, plus a bounded migration that rewrites and checks the
stored documents.

#### Scenario: New optional field

- **WHEN** a developer adds an optional field to events
- **THEN** every stored document parses without a migration

#### Scenario: Breaking change

- **WHEN** a developer needs to change what a field means
- **THEN** the change includes a schema version bump, an upgrade on read, and
  a migration that checks each rewritten document

### Requirement: Sources

The system SHALL store each public web page that supports a fact as a source in
the Entity's About document, with its URL, title, publisher, publication date
when known, and status. Two sources in one document SHALL NOT share a
normalized URL.

#### Scenario: Same page cited twice

- **WHEN** two events on one Entity cite the same Wikipedia page
- **THEN** both citations point to one source in that document

#### Scenario: Source page moves

- **WHEN** a source URL stops loading during a refresh
- **THEN** the source is marked unavailable and its citations remain, so the
  facts can be checked again

### Requirement: Citations carry the stated value

A citation SHALL link one fact to one source and store a short quote of the
supporting passage and the value that source states, such as a date or a
number. A quote SHALL be no longer than 300 characters. Quotes SHALL stay out
of public API responses.

#### Scenario: Two sources give different years

- **WHEN** one citation states 1969 and another states 1975 for the same
  renamed event
- **THEN** both citations are stored with their stated years

#### Scenario: Public read

- **WHEN** a visitor reads an Entity's history through the API
- **THEN** the response includes each citation's source and stated value but
  not its quote

### Requirement: Retailer-only facts are not published

Each source SHALL have a kind: `official` (the producer, government, or
heritage records), `reference` (histories and encyclopedias), `press`, or
`retailer` (shops, auctions, and forums). A fact whose only citations are
`retailer` sources SHALL be stored but not shown.

#### Scenario: Retailer blog only

- **WHEN** a closing month is cited only from a shop's blog
- **THEN** the fact is not shown on the page

### Requirement: Conflicting sources stay visible

When citations for a fact state different values, the document SHALL store the
best-supported value, which SHALL be one of the stated values, and the page
SHALL show a "Sources disagree" note listing every stated value and its
sources.

#### Scenario: Disputed rename year

- **WHEN** citations state 1968, 1969, and 1975 for a rename
- **THEN** the page shows 1969 and a note listing all three years with their
  sources

### Requirement: Entity history events

Entity history events SHALL live in the About document; the `entity_event`
table SHALL be retired after its rows are copied. An event SHALL have a kind, a date of a year, a year and month,
or a full date, an optional end date, optional text, and one or more
citations. Event kinds SHALL include `opened`, `closed`, `mothballed`,
`reopened`, `acquired`, `renamed`, `era`, and `generic`. A `renamed` event
SHALL store the new name. An `era` event SHALL have an end date or be marked
as continuing, and a short title. An event MAY link one related Entity, such as
a distillery built next door. An `acquired` event SHALL link the new owner.
Writes SHALL check that linked Entities exist, and reads SHALL follow merged
Entities to their current record.

#### Scenario: Name change

- **WHEN** the original Clynelish is renamed Brora
- **THEN** a `renamed` event stores the name "Brora" and the date

#### Scenario: Era

- **WHEN** a distillery made heavily peated malt from 1969 to 1973
- **THEN** an `era` event stores the title, the start, and the end

#### Scenario: Merged owner

- **WHEN** an event's new owner was merged into another Entity
- **THEN** the event shows the Entity it was merged into, and the document is
  not rewritten

#### Scenario: Related Entity

- **WHEN** an event records a new distillery built next door
- **THEN** the event links that Entity and both Entities' timelines show it

### Requirement: Distillery site facts

A Distillery SHALL have optional site facts drawn from a typed field list in
code. The first fields SHALL be wash still count, spirit still count, other
still count, capacity in litres of alcohol a year, water source, heating
method, and building listing. Each field SHALL state its value type, unit, and
the Entity kinds it applies to. Each value SHALL have an as-of
date and at least one citation. A site fact SHALL NOT be stored for an Entity
kind its field does not apply to.

#### Scenario: Capacity changes

- **WHEN** a distillery's capacity is updated from a newer source
- **THEN** the new value and its as-of date replace the old value, and the old
  value remains in change history

#### Scenario: Brand with site facts

- **WHEN** a write tries to add site facts to a Brand
- **THEN** the system rejects the write

### Requirement: Fact changes are recorded

The system SHALL save the full About document to change history on every
write, with its actor: the person or the pipeline. A moderator SHALL be able
to restore an earlier version.

#### Scenario: Pipeline adds an event

- **WHEN** the pipeline publishes a new event
- **THEN** change history shows the event and the pipeline as the actor
