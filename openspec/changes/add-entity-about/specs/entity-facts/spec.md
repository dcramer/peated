## ADDED Requirements

### Requirement: Shared sources

The system SHALL store each public web page that supports a fact as one source
with its normalized URL, title, publisher, publication date when known, source
site, and license note. Two sources SHALL NOT share a normalized URL. Every
fact, event, and paragraph that cites the same page SHALL use the same source.

#### Scenario: Same page cited twice

- **WHEN** two Entities cite the same Wikipedia page
- **THEN** both citations point to one stored source

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

The system SHALL keep a reviewed list of source sites, each with a tier:
`primary` (the producer, official records, government and heritage registers),
`reference` (archive-based histories and encyclopedias), `press` (trade
press), or `finder` (retailers, auctions, and forums). People change this list,
not the pipeline. A page from a site not on the list SHALL NOT support a
published fact.

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

An Entity history event SHALL have a kind, a date of a year, a year and month,
or a full date, an optional end date, optional text, and one or more
citations. Event kinds SHALL include `opened`, `closed`, `mothballed`,
`reopened`, `acquired`, `renamed`, `era`, and `generic`. A `renamed` event
SHALL store the new name. An `era` event SHALL have an end date or be marked
as continuing, and a short title. An event MAY link one related Entity, such as
a distillery built next door. The existing `acquired` rule for a new owner
SHALL remain.

#### Scenario: Name change

- **WHEN** the original Clynelish is renamed Brora
- **THEN** a `renamed` event stores the name "Brora" and the date

#### Scenario: Era

- **WHEN** a distillery made heavily peated malt from 1969 to 1973
- **THEN** an `era` event stores the title, the start, and the end

#### Scenario: Related Entity

- **WHEN** an event records a new distillery built next door
- **THEN** the event links that Entity and both Entities' timelines show it

### Requirement: Distillery site facts

A Distillery SHALL have optional typed site facts: wash still count, spirit
still count, other still count, capacity in litres of alcohol a year, water
source, heating method, and building listing. Each value SHALL have an as-of
date and at least one citation. Site facts SHALL NOT be stored for other
Entity kinds.

#### Scenario: Capacity changes

- **WHEN** a distillery's capacity is updated from a newer source
- **THEN** the new value and its as-of date replace the old value, and the old
  value remains in change history

#### Scenario: Brand with site facts

- **WHEN** a write tries to add site facts to a Brand
- **THEN** the system rejects the write

### Requirement: People's edits outrank automated updates

Each fact, event, and About section SHALL record whether it was written by a
person or by the pipeline. The pipeline SHALL NOT change or delete anything a
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

The system SHALL record every create, update, or delete of a source, citation,
event, site fact, or About section in change history with its actor, the
person or the pipeline.

#### Scenario: Pipeline adds an event

- **WHEN** the pipeline publishes a new event
- **THEN** change history shows the event and the pipeline as the actor
