## ADDED Requirements

### Requirement: Current editorial feeds use bounded discovery

The system SHALL discover a fixed maximum number of current articles from a
registered publisher feed and SHALL fetch them through the shared scraper
runtime.

#### Scenario: Scheduled Whiskyfun run

- **WHEN** the daily Whiskyfun run reads its public feed
- **THEN** it considers at most 20 current feed items
- **AND** all requests use the registered origin, robots rules, spacing, quota,
  retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a Whiskyfun run is deferred after it stores an article
- **THEN** the resumed run does not request that completed article again

### Requirement: Feed articles preserve publisher facts

The system SHALL store each feed article by canonical URL with its explicit
publisher date, title, reviewer when supplied, and native review scores.

#### Scenario: Article contains several reviews

- **WHEN** one Whiskyfun article contains several scored whisky reviews
- **THEN** the system stores one review article with one independently matched
  review for each valid bottle heading and score

#### Scenario: Feed supplies a publication date

- **WHEN** the Whiskyfun feed supplies a valid publication date for an article
- **THEN** the system stores that exact date as the article publication date

### Requirement: Publisher content remains transient

The system MUST NOT persist Whiskyfun HTML, full review prose, or publisher
images as source content.

#### Scenario: Review text is processed

- **WHEN** the source policy permits Peated to generate a review summary
- **THEN** the adapter passes only that review's text through the existing
  transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
