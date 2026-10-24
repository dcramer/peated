## ADDED Requirements

### Requirement: One About document per Entity

The system SHALL store each Entity's sources, citations, history events, site
facts, and About sections in one About document. Every read and write SHALL
check the document against the About schema in code. The document is a
generated page: each writer run or moderator patch SHALL save a complete new
version. A write SHALL include the document version it read, and the system
SHALL reject a write based on an older version.

#### Scenario: Two writers

- **WHEN** the pipeline and a moderator both read version 4 and the moderator
  saves first
- **THEN** the pipeline's write is rejected and it retries from version 5

#### Scenario: Invalid document

- **WHEN** a write contains a site fact that is not in the field list
- **THEN** the write is rejected and the stored document is unchanged

### Requirement: About schema changes stay backward compatible

Changes to the About document schema SHALL be rare. The same rule SHALL apply
to the public About API response, which changes only by adding fields. A change SHALL add only
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

### Requirement: Nothing is shown without a source

Every event and site fact SHALL have at least one citation to a source in the
document, whoever writes it: the pipeline or a moderator. Every sentence SHALL
cite facts, so it traces to their sources. The system SHALL reject a write that
adds an uncited event, site fact, or sentence. A source that no fact cites
SHALL be removed on save.

#### Scenario: Moderator adds an event without a source

- **WHEN** a moderator saves a new closing event with no citation
- **THEN** the write is rejected with a message asking for a source

#### Scenario: Pipeline fact loses its only citation

- **WHEN** the quote check drops a fact's only citation
- **THEN** the fact is dropped, and any sentence citing it fails the checks

### Requirement: Sources

The system SHALL store each public web page that supports a fact as a source in
the Entity's About document, with its URL, title, publisher, publication date
when known. Two sources in one document SHALL NOT share a
normalized URL.

#### Scenario: Same page cited twice

- **WHEN** two events on one Entity cite the same Wikipedia page
- **THEN** both citations point to one source in that document

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

### Requirement: Shops are not sources

Each source SHALL have a kind: `official` (the producer, government, or
heritage records), `reference` (histories and encyclopedias), or `press`.
The pipeline SHALL NOT cite shops, auctions, or forums; it MAY use them only
to find other sources.

#### Scenario: Shop blog only

- **WHEN** a closing month appears only on a shop's blog
- **THEN** the draft leaves the month out unless another source states it

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

The About page SHALL describe history with its own events. The Entity's
history timeline SHALL stay in `entity_event` as a separate widget, and the
writer SHALL read it as leads. An About event SHALL have a kind, a date of a
year, a year and month, or a full date, an optional end date, optional text,
and one or more citations. Event kinds SHALL include `opened`, `closed`, `mothballed`,
`reopened`, `acquired`, `renamed`, `era`, and `generic`. A `renamed` event
SHALL store the new name. An `era` event SHALL have an end date or be marked
as continuing, and a short title. An event MAY link one related Entity, such as
a distillery built next door. An `acquired` event SHALL store the new owner's name and MAY link the owner's
Entity. The pipeline SHALL NOT create Entities. Reads SHALL follow merged
Entities to their current record, and SHALL show the name when the linked
Entity no longer exists.

#### Scenario: Name change

- **WHEN** the original Clynelish is renamed Brora
- **THEN** a `renamed` event stores the name "Brora" and the date

#### Scenario: Era

- **WHEN** a distillery made heavily peated malt from 1969 to 1973
- **THEN** an `era` event stores the title, the start, and the end

#### Scenario: Owner without an Entity

- **WHEN** a source says the Sutherland estate owned a distillery and Peated
  has no Entity for the estate
- **THEN** the `acquired` event stores the name "Sutherland estate" with no
  Entity link

#### Scenario: Deleted owner

- **WHEN** an event's linked owner Entity is deleted
- **THEN** the page shows the owner's name without a link

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

### Requirement: Moderator notes for the writer

The system SHALL store plain-text notes for an Entity's About page, each up
to 500 characters with an optional source URL. Moderators SHALL list, add,
and remove notes. Every writer run SHALL read them. Notes SHALL NOT be cited
or shown on the page.

#### Scenario: Note added

- **WHEN** a moderator adds a note that two distilleries have used the name
  Clynelish
- **THEN** the next writer run gets the note, and the page shows only facts
  that cite a web source

#### Scenario: Note on another Entity

- **WHEN** a moderator removes a note through a different Entity's route
- **THEN** the request fails with not found and the note stays

### Requirement: Entity merge leaves About documents to the writer

When one Entity is merged into another, the system SHALL keep the
destination's About document unchanged and SHALL NOT copy the merged Entity's
document into it. The merged Entity's document SHALL remain in change history.
The system SHALL move the merged Entity's history timeline and notes to the
destination and SHALL queue a writer run for the destination.

#### Scenario: Merge two distilleries with About documents

- **WHEN** a duplicate distillery with an About document and notes is merged
  into its original
- **THEN** the original's document is unchanged, the duplicate's document is
  only in change history, the notes move to the original, and a writer run is
  queued for the original
