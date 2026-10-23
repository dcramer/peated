## ADDED Requirements

### Requirement: One job writes an About document

The `writeEntityAbout` job SHALL make one model call per run. The model SHALL
search and read public pages with the existing web search and page-fetch
tools, and SHALL return a complete About document: sources, events, site
facts, and sections. The job SHALL run for one Entity at a time and SHALL stop
at a fixed limit of searches and page reads.

#### Scenario: Run for a distillery

- **WHEN** the job runs for Brora
- **THEN** it returns one About document draft built from the pages it read
  in that run

### Requirement: Quotes are checked against pages read

Every citation SHALL include a short quote. Code SHALL drop a citation when
its quote does not appear in a page the model read in the same run, after
whitespace and punctuation are normalized. A fact left with no citations SHALL
be dropped.

#### Scenario: Invented quote

- **WHEN** the model cites a founding year with a quote that is not on any
  page it read
- **THEN** that citation and the unsupported fact are dropped

### Requirement: Prose comes only from facts in the document

Each sentence SHALL list the facts it uses. Code SHALL reject a sentence that
lists no facts, or that contains a year or number not found in the facts it
lists. Sentences SHALL NOT state Bottle counts, ratings, or other catalog
numbers, because those change every day; the page's charts show them.

#### Scenario: Filler sentence

- **WHEN** a sentence says the distillery "is known for its rich history" and
  lists no facts
- **THEN** the draft is rejected

#### Scenario: Catalog count in prose

- **WHEN** a sentence says "Peated lists 255 Brora bottles"
- **THEN** the draft is rejected

#### Scenario: Wrong year

- **WHEN** a sentence says "closed in 1985" but its cited fact states 1983
- **THEN** the draft is rejected

### Requirement: Length follows evidence

A draft SHALL have at most one sentence for each fact it publishes and a lead
of at most 4 sentences. It SHALL have no sections when it has fewer than 6
published facts, and no prose when it has fewer than 2.

#### Scenario: Thin record

- **WHEN** a brand has 3 published facts
- **THEN** the draft has a lead of at most 3 sentences and no sections

### Requirement: Banned phrases are rejected

Code SHALL reject a draft that uses a phrase from the banned list in the
`peated-writing` skill or a sentence longer than 30 words. The skill and the
check SHALL use the same list.

#### Scenario: Stock phrase

- **WHEN** a draft calls a distillery "iconic"
- **THEN** the draft is rejected

### Requirement: Failure keeps what exists

A rejected draft SHALL be retried once. If the retry also fails, the job SHALL
keep the stored document unchanged and log the reason. It SHALL NOT save
unsourced text.

#### Scenario: Two rejected drafts

- **WHEN** both drafts for a new Entity fail the checks
- **THEN** no About document is saved and the Entity keeps its current page

### Requirement: People's edits are kept

The job SHALL keep every item a person wrote and SHALL replace only items the
pipeline wrote. It SHALL NOT change an Entity's name, kind, owner, status, or
Bottles.

#### Scenario: Moderator fixed a date

- **WHEN** a moderator corrected an event's year and the job runs again
- **THEN** the corrected event is kept as the moderator wrote it

### Requirement: Runs happen on request

The job SHALL run when an administrator queues it for one Entity or for a
batch ordered by public activity. The job SHALL NOT run on a schedule. A
configuration switch SHALL stop new runs. Saved drafts SHALL publish without
approval.

#### Scenario: Backfill

- **WHEN** an administrator queues the 200 most active distilleries
- **THEN** the job runs for each, and drafts that pass the checks publish
  immediately
