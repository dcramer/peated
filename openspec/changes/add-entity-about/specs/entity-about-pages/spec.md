## ADDED Requirements

### Requirement: About tab

A Distillery, Brand, Bottler, or Company page SHALL show an About tab after
Overview when the Entity has a published lead and at least one other About
part. Otherwise the tab SHALL be hidden, and the Overview and its description
SHALL carry what Peated knows.

#### Scenario: Rich distillery

- **WHEN** a visitor opens a distillery with a published lead, sections, and a
  timeline
- **THEN** the page shows an About tab after Overview

#### Scenario: Thin brand

- **WHEN** a brand has a published lead and nothing else
- **THEN** no About tab is shown and the lead is the page description

### Requirement: Fixed About template

The About page SHALL place its parts in a fixed order for each Entity kind.
Writers and the pipeline SHALL NOT choose layout or embed parts inside text.

- Distillery: lead, timeline, sections, Bottles by year distilled, who
  bottled it, how it's made, sources. The sidebar holds images, key facts, and
  owners.
- Brand: lead, timeline, sections, which distilleries make it, releases by
  year, sources. The sidebar holds images, key facts, and owners.
- A distillery that is also a Brand under the identity model SHALL use the
  distillery template and add releases by year.

#### Scenario: Two distilleries

- **WHEN** a visitor opens the About pages of two distilleries
- **THEN** the parts that exist appear in the same order on both

### Requirement: Parts show only with enough data

Each About part SHALL have a minimum and SHALL be hidden below it. An empty
part SHALL NOT show a heading, a placeholder, or filler text.

- Timeline: at least 2 dated periods or names.
- Bottles by year distilled: at least 10 Bottles with a vintage year.
- Who bottled it: at least 3 Bottlers.
- Releases by year: at least 10 Bottles with a release year. A distillery counts
  every Bottle distilled there; a bottler counts the Bottles it bottled; a
  brand counts the Bottles sold under it.
- Key facts: at least 2 published facts.

#### Scenario: Few vintages

- **WHEN** a distillery has 6 Bottles with a vintage year
- **THEN** the Bottles by year distilled chart is hidden

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

Every paragraph and key fact SHALL show numbered citations that link to a
Sources list. When sources disagree on a fact shown in the text, the section
SHALL show a "Sources disagree" note naming each stated value and its sources.
The page SHALL show the date its sources were last checked. The page SHALL NOT
add other statements about how the text was written.

#### Scenario: Disputed rename year

- **WHEN** sources state 1968, 1969, and 1975 for a rename
- **THEN** the section shows the published year and a note listing all three
  years with their sources

### Requirement: Era context on Bottle pages

A Bottle with exactly one distiller and a vintage year SHALL show one line
naming the published era or former name that covers that year, with a link to
the distillery's About page. A Bottle with several distillers, no vintage, or
no matching era SHALL show nothing.

#### Scenario: Peated era

- **WHEN** a visitor opens a single-distiller Brora Bottle distilled in 1972
- **THEN** the page shows "Distilled during Brora's heavily peated years
  (1969–1973)" with a link

#### Scenario: Former name

- **WHEN** a visitor opens a Brora Bottle distilled in 1965
- **THEN** the page shows that the distillery was called Clynelish when it
  was distilled

### Requirement: History timeline stays a simple widget

The Overview SHALL keep showing the Entity's history timeline from
`entity_event`, whether or not the Entity has an About tab. The About page's
events SHALL roughly cover the timeline but SHALL NOT replace it.

#### Scenario: Overview with About

- **WHEN** a visitor opens the Overview of a distillery with an About tab
- **THEN** the history timeline is shown as before

### Requirement: About pages are public and indexable

About pages SHALL be public, canonical, and in the sitemap. Structured data
SHALL include only facts shown on the page.

#### Scenario: Search engine reads About

- **WHEN** a crawler opens an About page
- **THEN** it receives a canonical URL and structured data for the founding
  date and location shown on the page

### Requirement: Moderators can hide an About page

A moderator SHALL be able to hide an Entity's About page and show it again.
Hiding SHALL keep the document. A hidden page SHALL behave as if the Entity
had no About page, and the job SHALL NOT show it again.

#### Scenario: Hide a bad page

- **WHEN** a moderator hides a distillery's About page
- **THEN** the About tab disappears, the document is kept, and later runs
  leave it hidden
