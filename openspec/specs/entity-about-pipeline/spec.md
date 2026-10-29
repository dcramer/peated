# entity-about-pipeline Specification

## Purpose

Define the job that writes an Entity's About document: its research limits, the checks every draft must pass, and how passing drafts are saved.

## Requirements

### Requirement: One job writes an About document

The `writeEntityAbout` job SHALL make one model call per run. The model SHALL
search and read public pages with web search and page-fetch tools, look up
Peated Entities with Entity search, and SHALL return the complete next version of the About page:
sources, events, site facts, and sections. The model SHALL get the Entity's
fields, its notes, its history timeline, and the current page, and MAY keep,
correct, add, or drop anything. The job SHALL run for one Entity at a time and
SHALL stop at a fixed limit of searches and page reads.

#### Scenario: Run for a distillery

- **WHEN** the job runs for Brora
- **THEN** it returns one complete page built from the pages it read in that
  run and the citations it kept from the current page

#### Scenario: Run for a company

- **WHEN** the job runs for Diageo
- **THEN** its events cover the business, such as mergers and the
  distilleries and brands it bought, and leave each distillery's own history
  to that distillery's page

#### Scenario: Run for a bottler

- **WHEN** the job runs for The Scotch Malt Whisky Society
- **THEN** its events cover the business, such as its founding, owners, and
  the ranges it launched, and leave out single bottlings

#### Scenario: Page rewritten

- **WHEN** the current page has a fact no page supports anymore
- **THEN** the next version may drop it, and the old version stays in change
  history

### Requirement: Quotes are checked against pages read

Every citation SHALL include a short quote. Code SHALL drop a citation when
its quote does not appear in a page the model read in the same run, after
whitespace and punctuation are normalized, unless it is the same quote from
the same page as a citation the current page already has. A fact left with no
citations SHALL be dropped.

#### Scenario: Kept citation

- **WHEN** the model keeps a citation exactly as the current page has it and
  does not read that page again
- **THEN** the citation stands

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

A draft SHALL have at most two sentences for each fact it publishes and a lead
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

A rejected draft SHALL be retried once. The retry SHALL get the rejected
draft and the reasons, including why each dropped fact was dropped, and pages
read on the first try SHALL count on the retry. On the retry, the job SHALL leave out
sentences that cite a fact the checks dropped, SHALL trim sentences from the
end, sections beyond the lead first, until the length limits fit, and SHALL
check the rest again. It SHALL NOT remove the lead of a stored page. If the retry still fails, the job SHALL keep the
stored document unchanged and log the reason. It SHALL NOT save unsourced
text.

#### Scenario: Retry keeps the first try's pages

- **WHEN** the retry fixes the rejected draft and cites a page read only on
  the first try
- **THEN** the job keeps that citation

#### Scenario: Retry runs past its length limit

- **WHEN** the retry has more than two sentences for each shown fact
- **THEN** the job saves the page with sentences trimmed from the end

#### Scenario: Retry cites a dropped fact

- **WHEN** the retry passes except for one sentence citing a fact whose quote
  was not on a page read
- **THEN** the job saves the page without that sentence

#### Scenario: Two rejected drafts

- **WHEN** both drafts for a new Entity fail the checks
- **THEN** no About document is saved and the Entity keeps its current page

### Requirement: Each save is a new version

The job SHALL save a passing draft as the next version of the page, with a
version check, and record it in change history. A page edited during the run
SHALL fail the check, and the job SHALL keep the edited version and save
nothing. The job
SHALL NOT change an Entity's name, kind, owner, status, or Bottles.

#### Scenario: Bad run

- **WHEN** a run publishes a wrong fact
- **THEN** a moderator restores the earlier version from change history

#### Scenario: Edit during a run

- **WHEN** a moderator saves the page while the job is running
- **THEN** the job's save fails the version check, the moderator's version
  stays, and the job saves nothing

### Requirement: Notes and history guide the writer

Every run SHALL read the Entity's notes and its history timeline. They SHALL
be leads for the writer, not sources: every shown fact SHALL still cite a
page. The page's events SHOULD cover the history timeline when a page the
writer reads supports it.

#### Scenario: Note keeps a fix

- **WHEN** a moderator adds the note "Not the modern Clynelish next door"
- **THEN** every later run gets that note

#### Scenario: Timeline item

- **WHEN** the history timeline has "closed 1983" and a page the writer reads
  states it
- **THEN** the page includes a closing event in 1983

### Requirement: Entities are linked from Entity search

An acquisition SHALL store the new owner's name. The writer SHALL link an
owner or another Entity only by an ID that Entity search returned in the run
or that the current page already has; the job SHALL clear any other ID and
SHALL NOT create Entities.

#### Scenario: Search result

- **WHEN** Entity search returned "Distillers Company" and the draft links it
  as the new owner
- **THEN** the event stores the name and links that Entity

#### Scenario: Unknown ID

- **WHEN** a draft links an Entity ID no search returned and the current page
  does not have
- **THEN** the link is cleared and the name stays

### Requirement: Runs happen on request

The job SHALL run when an administrator queues it for one Entity or for a
batch ordered by public activity. The job SHALL NOT run on a schedule. A
configuration switch SHALL stop new runs. Saved drafts SHALL publish without
approval.

#### Scenario: Batch

- **WHEN** an administrator queues the 200 most active distilleries
- **THEN** the job runs for each, and drafts that pass the checks publish
  immediately
