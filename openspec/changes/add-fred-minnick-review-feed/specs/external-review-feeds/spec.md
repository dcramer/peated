## ADDED Requirements

### Requirement: Fred Minnick discovery is bounded

The system SHALL discover at most five recent single-Bottle Fred Minnick review
articles from the newest two public post sitemaps and SHALL fetch them through
the shared scraper runtime.

#### Scenario: Scheduled current-review run

- **WHEN** the daily source run reads the Fred Minnick sitemap index
- **THEN** it requests only the newest two post sitemaps
- **AND** it considers only five same-origin URLs with a supported review slug
- **AND** all requests use the registered origin, robots rules, 30-second
  spacing, quota, retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a run is deferred after it stores an article
- **THEN** the resumed run does not request that completed current article
  again

### Requirement: Fred Minnick article facts remain source-accurate

The system SHALL store each complete current article by canonical URL with its
title, explicit publication date, Bottle name, and Fred Minnick reviewer
attribution. The system MUST keep native and normalized scores absent when the
article does not publish a stable score.

#### Scenario: Complete single-Bottle review

- **WHEN** a current article has a supported review title, canonical URL, and
  explicit publication date
- **THEN** the system stores one unscored review for the derived Bottle name
- **AND** it attributes the review to Fred Minnick

#### Scenario: Review-shaped article is incomplete

- **WHEN** a selected article lacks a supported title, canonical URL, or valid
  publication date
- **THEN** the adapter fails without checkpointing that article

### Requirement: Fred Minnick prose remains transient

The system MUST NOT persist Fred Minnick HTML, full review prose, publisher
images, price text, related links, or site furniture as source content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only direct tasting paragraphs through the
  existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
