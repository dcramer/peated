# entity-about-pages Specification

## Purpose

Define how an Entity's sourced About document appears on its Overview: the page order, what folds, and how sources and disagreements show. `docs/features/entity-page.md` and `docs/features/entity-about.md` explain the rules.

## Requirements

### Requirement: About content lives on the Entity Overview

A Distillery, Brand, Bottler, or Company SHALL show its About document on its
Overview when the Entity has a published lead and at least one other About
part: a section, a timeline of 2 or more dated periods or names, or 2 or more
key facts. There SHALL be no separate About tab or URL; a request for an old
`/about` URL SHALL redirect permanently to the Overview. When the document is
not shown, the Overview SHALL show its other parts and the Entity's
description.

#### Scenario: Rich distillery

- **WHEN** a visitor opens a distillery with a published lead, sections, and a
  timeline
- **THEN** the Overview shows the lead, timeline, history, and sources, and
  the page has no About tab

#### Scenario: Old About link

- **WHEN** a visitor opens `/distillers/116-brora/about`
- **THEN** Peated answers with a permanent redirect to `/distillers/116-brora`

#### Scenario: Thin brand

- **WHEN** a brand has a published lead and nothing else
- **THEN** the Overview shows no About parts and the lead is the page
  description

### Requirement: Fixed Overview order

The Overview SHALL place its parts in the fixed order that
`docs/features/entity-page.md` owns, and SHALL state each thing once. Writers
and the pipeline SHALL NOT choose layout or embed parts inside text.

#### Scenario: Two distilleries

- **WHEN** a visitor opens the Overviews of two distilleries
- **THEN** the parts that exist appear in the same order on both: lead,
  timeline, one catalog list, history, charts, recent activity, and sources,
  beside a sidebar of images, facts, owners, map, and related Entities

#### Scenario: One summary

- **WHEN** an Overview shows its About lead
- **THEN** the header leaves out the description on that tab

#### Scenario: One founding year

- **WHEN** a distillery stores 1819 and its About document has a sourced
  opening in 1819
- **THEN** one Facts list shows a single "Founded" row, beside the About
  document's other key facts

### Requirement: One catalog list leads the Overview

The Overview SHALL show one catalog list before the history, chosen by the
Entity's kind, with 4 rows and a link to the full list on its tab. Series,
other bottlings, and the rest of a company's portfolio SHALL stay on their
tabs.

#### Scenario: Distillery with its own releases

- **WHEN** a visitor opens a distillery that has releases of its own
- **THEN** the Overview shows its latest distillery releases

#### Scenario: Silent distillery with only independent bottlings

- **WHEN** a distillery has no releases of its own and 40 independent
  bottlings
- **THEN** the Overview shows "Latest bottlings" with the newest of them

#### Scenario: Brand or bottler

- **WHEN** a visitor opens a brand or a bottler with Bottles
- **THEN** the Overview shows its latest releases

#### Scenario: Company with mostly brands

- **WHEN** a company owns 75 brands, 55 distilleries, and 22 bottlers
- **THEN** the Overview shows its brands, with a link to all 75

#### Scenario: No Bottles

- **WHEN** a brand has no Bottles
- **THEN** the Overview shows a prompt to add one

### Requirement: Parts show only with enough data

Each About part SHALL have a minimum and SHALL be hidden below it. An empty
part SHALL NOT show a heading, a placeholder, or filler text.

- Timeline: at least 2 dated periods or names.
- Bottles by year distilled: at least 10 Bottles with a vintage year.
- Releases by year: at least 10 Bottles with a release year. A distillery counts
  every Bottle distilled there; a bottler counts the Bottles it bottled; a
  brand counts the Bottles sold under it.

#### Scenario: Few vintages

- **WHEN** a distillery has 6 Bottles with a vintage year
- **THEN** the Bottles by year distilled chart is hidden

### Requirement: Long About content folds

Long About content SHALL fold behind a control and SHALL stay in the page's
HTML.

- History: when more than 4 sections exist, the first 3 SHALL show, and a
  "Read the full history" button SHALL name the sections it holds.
- A "Sources disagree" note SHALL show one line until a reader opens it.
- Sources: the page SHALL show how many sources it cites and the date they
  were checked; the list SHALL open with a button or when a reader follows a
  citation number to it.

#### Scenario: Long history

- **WHEN** a distillery's About document has 7 sections
- **THEN** 3 show, and the button's line names the other 4

#### Scenario: Follow a citation

- **WHEN** a reader selects citation 12 while the sources list is folded
- **THEN** the list opens and scrolls to source 12

### Requirement: Catalog numbers are exact

Catalog charts SHALL use exact counts of active Bottles from Peated's records,
SHALL say how many Bottles they leave out, and SHALL link each bar or row to
the matching Bottle list. They SHALL include a table for screen readers.

#### Scenario: Missing vintages

- **WHEN** 14 of a distillery's 255 Bottles have no vintage year
- **THEN** the chart says that 14 Bottles without a vintage year aren't shown

#### Scenario: Open a year

- **WHEN** a visitor selects the 1972 bar
- **THEN** Peated opens the distillery's Bottles filtered to vintage 1972

### Requirement: Bottle list vintage filter

The Bottle list API and the Entity Bottles tab SHALL accept a vintage year
filter.

#### Scenario: Filter by vintage

- **WHEN** a client lists a distillery's Bottles with vintage 1972
- **THEN** only Bottles with vintage year 1972 are returned

### Requirement: Sources and disagreements are shown

Every sentence SHALL show numbered citations, at most 3, that link to a
Sources list; key facts SHALL show none. When sources disagree on a fact shown
in the text, the section SHALL show a "Sources disagree" note naming each
stated value and its sources. The page SHALL show the date its sources were
last checked. The page SHALL NOT add other statements about how the text was
written.

#### Scenario: Disputed rename year

- **WHEN** sources state 1968, 1969, and 1975 for a rename
- **THEN** the section shows the published year and a note listing all three
  years with their sources

### Requirement: Era context on Bottle pages

A Bottle with exactly one distiller and a vintage year SHALL show one line
naming the published era or former name that covers that year, with a link to
the history on the distillery's Overview. A Bottle with several distillers, no
vintage, or no matching era SHALL show nothing.

#### Scenario: Peated era

- **WHEN** a visitor opens a single-distiller Brora Bottle distilled in 1972
- **THEN** the page shows "Distilled during Brora's heavily peated years
  (1969–1973)" with a link

#### Scenario: Former name

- **WHEN** a visitor opens a Brora Bottle distilled in 1965
- **THEN** the page shows that the distillery was called Clynelish when it
  was distilled

### Requirement: The About document is the public history

The Overview SHALL show the About document as the Entity's history. It SHALL
NOT show the history timeline from `entity_event`; the writer reads that
timeline as leads.

#### Scenario: Overview with About

- **WHEN** a visitor opens the Overview of a distillery with a shown About
  document
- **THEN** the history comes from the About document, with its sources

### Requirement: About content is indexed with the Overview

About content SHALL be public and indexed as part of the Overview's canonical
URL. It SHALL NOT have its own sitemap entries. Structured data SHALL include
only facts shown on the page.

#### Scenario: Search engine reads an Overview with About

- **WHEN** a crawler opens a distillery Overview that shows its About document
- **THEN** it receives the Overview's canonical URL and structured data for
  the founding date shown on the page

### Requirement: Moderators can hide an About page

A moderator SHALL be able to hide an Entity's About page and show it again.
Hiding SHALL keep the document. A hidden page SHALL behave as if the Entity
had no About page, and the job SHALL NOT show it again.

#### Scenario: Hide a bad page

- **WHEN** a moderator hides a distillery's About page
- **THEN** the About parts leave the Overview, the document is kept, and later
  runs leave it hidden
