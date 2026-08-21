## ADDED Requirements

### Requirement: Current review pages use bounded discovery

The system SHALL discover at most five current The Whiskey Reviewer articles
from the Recent Reviews list on its public homepage and SHALL fetch them through
the shared scraper runtime.

#### Scenario: Scheduled current-review run

- **WHEN** the daily source run reads The Whiskey Reviewer homepage
- **THEN** it considers only the five current links in the Recent Reviews list
- **AND** all requests use the registered origin, robots rules, spacing, quota,
  retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a run is deferred after it stores an article
- **THEN** the resumed run does not request that completed current article
  again

### Requirement: Article facts preserve the publisher grade

The system SHALL store each complete current article by canonical URL with its
title, writer, Bottle name, displayed letter grade, and publication date when
the current article URL supplies a valid date.

#### Scenario: Article has a recognized grade

- **WHEN** a current article contains one Bottle review with a supported letter
  grade
- **THEN** the system stores one review with the publisher letter as its native
  score display
- **AND** it derives the normalized rating from the source-owned grade mapping

#### Scenario: Article URL has no valid date

- **WHEN** a complete current article does not encode a valid publication date
- **THEN** the system stores the article with a null publication date

### Requirement: Publisher content remains transient

The system MUST NOT persist The Whiskey Reviewer HTML, full review prose,
publisher images, price text, or publisher conclusions as source content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only tasting-note paragraphs through the existing
  transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
