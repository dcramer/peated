## ADDED Requirements

### Requirement: Current review pages use bounded discovery

The system SHALL discover a fixed maximum number of current Words of Whisky
articles from its public homepage and SHALL fetch them through the shared
scraper runtime.

#### Scenario: Scheduled Words of Whisky run

- **WHEN** the daily source run reads the Words of Whisky homepage
- **THEN** it considers at most 20 current tasting-note articles
- **AND** all requests use the registered origin, robots rules, spacing, quota,
  retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a Words of Whisky run is deferred after it stores an article
- **THEN** the resumed run does not request that completed current article
  again

### Requirement: Review sections preserve publisher facts

The system SHALL store each article by canonical URL with its explicit date,
title, writer, Bottle headings, and native review scores.

#### Scenario: Article contains one Bottle

- **WHEN** a Words of Whisky article contains one complete scored Bottle review
- **THEN** the system stores one review article with one matched review

#### Scenario: Article contains several Bottles

- **WHEN** one Words of Whisky article contains several complete scored Bottle
  sections
- **THEN** the system stores one review article with one independently matched
  review for each valid section

#### Scenario: Article supplies an exact publication time

- **WHEN** a Words of Whisky article supplies a valid publication timestamp
- **THEN** the system stores that exact timestamp as the article publication
  date

### Requirement: Publisher content remains transient

The system MUST NOT persist Words of Whisky HTML, full review prose, publisher
images, article introductions, or publisher conclusions as source content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only that Bottle section's tasting notes through
  the existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
