## ADDED Requirements

### Requirement: Current editorial indexes use bounded discovery

The system SHALL discover a fixed maximum number of current articles from a
registered publisher review index and SHALL fetch them through the shared
scraper runtime.

#### Scenario: Scheduled Dramface run

- **WHEN** the daily Dramface run reads its public review index
- **THEN** it considers at most 20 current review articles
- **AND** all requests use the registered origin, robots rules, spacing, quota,
  retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a Dramface run is deferred after it stores an article
- **THEN** the resumed run does not request that completed article again

### Requirement: Review sections preserve publisher facts

The system SHALL store each review article by canonical URL with its explicit
publisher date, title, writer, Bottle text, and native review scores.

#### Scenario: Article contains several bottles

- **WHEN** one Dramface article contains several scored Bottle review sections
- **THEN** the system stores one review article with one independently matched
  review for each valid section

#### Scenario: Article contains several reviewers

- **WHEN** Dramface names a reviewer in a review section heading
- **THEN** the system preserves that reviewer on the matching review
- **AND** reviews without a section reviewer use the article writer

#### Scenario: Article supplies a publication date

- **WHEN** a Dramface article supplies a valid publication date
- **THEN** the system stores that exact date as the article publication date

### Requirement: Publisher content remains transient

The system MUST NOT persist Dramface HTML, full review prose, publisher images,
or publisher TL;DR text as source content.

#### Scenario: Review text is processed

- **WHEN** the source policy permits Peated to generate a review summary
- **THEN** the adapter passes only that review section's tasting prose through
  the existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
