## ADDED Requirements

### Requirement: Whisky Saga discovery is bounded to current Scotch reviews

The system SHALL discover at most 20 current Whisky Saga articles from the
public Scotland category and SHALL fetch them through the shared scraper
runtime.

#### Scenario: Scheduled current-review run

- **WHEN** the daily source run reads the Scotland category
- **THEN** it considers only 20 unique same-origin article URLs from current
  article cards
- **AND** all requests use the registered origin, robots rules, spacing, quota,
  retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a run is deferred after it stores an article
- **THEN** the resumed run does not request that completed current article
  again

### Requirement: Whisky Saga article facts remain source-accurate

The system SHALL store each complete current article by canonical URL with its
title, explicit publication date, Bottle name, reviewer, native 100-point
score, and normalized compatibility rating.

#### Scenario: Complete single-Bottle review

- **WHEN** a current article has a canonical URL, title, author, explicit date,
  direct tasting section, and valid 100-point score
- **THEN** the system stores one scored review for that Bottle

#### Scenario: Clear non-review article

- **WHEN** a current Scotland article has no direct tasting section
- **THEN** the adapter skips and checkpoints it

#### Scenario: Review-shaped article is incomplete

- **WHEN** a selected article has tasting text but lacks a required fact or a
  valid score
- **THEN** the adapter fails without checkpointing that article

### Requirement: Whisky Saga prose remains transient

The system MUST NOT persist Whisky Saga HTML, full review prose, publisher
images, product background, comments, or sign-off text as source content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only direct nose, taste, palate, and finish
  paragraphs through the existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
