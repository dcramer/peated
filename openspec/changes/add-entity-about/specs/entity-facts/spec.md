## ADDED Requirements

### Requirement: One About document per Entity

The system SHALL store each Entity's sources, citations, history events, site
facts, and About sections in one About document. Every read and write SHALL
check the document against the About schema in code. A write SHALL include
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

### Requirement: Source sites have reviewed tiers

The system SHALL keep a reviewed list of source sites in a typed file in code,
each with a tier: `primary` (the producer, official records, government and
heritage registers), `reference` (archive-based histories and encyclopedias),
`press` (trade press), or `finder` (retailers, auctions, and forums). The list
SHALL change only through code review, never through the pipeline. A page from
a site not on the list SHALL NOT support a published fact. Publishing rules
SHALL run on read, so a tier change applies without rewriting documents.

#### Scenario: Unlisted site

- **WHEN** the pipeline finds a fact only on a site that is not on the list
- **THEN** the fact is stored as unpublished

#### Scenario: Finder site

- **WHEN** a fact's only support is a retailer page
- **THEN** the fact is stored as unpublished

### Requirement: Published facts need enough support

A fact SHALL be published only when it has at least one citation from a
`primary` site, or citations from at least two different sites at the
`reference` or `press` tier. Citations from the same site SHALL count once.

#### Scenario: One primary source

- **WHEN** a listing date is cited only from the heritage register
- **THEN** the fact is published

#### Scenario: One reference source

- **WHEN** a closing year is cited only from one encyclopedia page
- **THEN** the fact is stored as unpublished

### Requirement: Conflicting sources stay visible

When citations for a fact state different values, the system SHALL publish the
value supported by the higher tier, or by more sites at the same tier. When
neither value has more support, the system SHALL leave the fact unknown. In
both cases the system SHALL keep every stated value and its sources available
for a "Sources disagree" note.

#### Scenario: Stronger support

- **WHEN** two reference sites state 1969 and one press site states 1975
- **THEN** the published year is 1969 and the note lists both values and their
  sources

#### Scenario: Even support

- **WHEN** one reference site states March 1983 and another states May 1983
- **THEN** the month is unknown, the year 1983 is published if all citations
  agree on it, and the note lists both months

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

### Requirement: People's edits outrank automated updates

Each site fact, event, and About section SHALL record whether a person or the
pipeline wrote it. The pipeline SHALL NOT change or delete anything a
person wrote. When the pipeline finds a conflict with a person's edit, it SHALL
create a moderation finding instead.

#### Scenario: Moderator fixed a date

- **WHEN** a moderator has corrected an event's year and a refresh finds a
  source with the old year
- **THEN** the event keeps the moderator's year and the Inbox gets a finding

### Requirement: Automated writes do not change identity

The pipeline SHALL NOT change an Entity's name, kind, owner, status, or
relationships to Bottles. When its facts suggest such a change, it SHALL
create a moderation finding.

#### Scenario: Owner looks out of date

- **WHEN** sourced events show a new owner that differs from the Entity's
  stored owner
- **THEN** the stored owner is unchanged and the Inbox gets a finding

### Requirement: Fact changes are recorded

The system SHALL save the full About document to change history on every
write, with its actor: the person or the pipeline. A moderator SHALL be able
to restore an earlier version.

#### Scenario: Pipeline adds an event

- **WHEN** the pipeline publishes a new event
- **THEN** change history shows the event and the pipeline as the actor
