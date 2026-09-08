## Purpose

Define source-accurate, bounded feeds for external whisky reviews.

## Requirements

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

### Requirement: Dramface review sections preserve publisher facts

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

### Requirement: Dramface content remains transient

The system MUST NOT persist Dramface HTML, full review prose, publisher images,
or publisher TL;DR text as source content.

#### Scenario: Review text is processed

- **WHEN** the source policy permits Peated to generate a review summary
- **THEN** the adapter passes only that review section's tasting prose through
  the existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link

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

### Requirement: The Whiskey Reviewer current pages use bounded discovery

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

### Requirement: The Whiskey Reviewer content remains transient

The system MUST NOT persist The Whiskey Reviewer HTML, full review prose,
publisher images, price text, or publisher conclusions as source content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only tasting-note paragraphs through the existing
  transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link

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

### Requirement: The Whisky Study discovery is bounded to current Scotch reviews

The system SHALL discover at most 20 current The Whisky Study articles from the
public Scotch review index and SHALL fetch them through the shared scraper
runtime.

#### Scenario: Scheduled current-review run

- **WHEN** the daily source run reads the Scotch review index
- **THEN** it considers only 20 unique same-origin article URLs from current
  article cards
- **AND** all requests use the registered origin, robots rules, spacing, quota,
  retry, and backoff controls

#### Scenario: Deferred run resumes

- **WHEN** a run is deferred after it stores an article
- **THEN** the resumed run does not request that completed current article
  again

### Requirement: The Whisky Study article facts remain source-accurate

The system SHALL store each complete current article by canonical URL with its
title, explicit publication date, Bottle name, reviewer, native 100-point
score, and normalized compatibility rating.

#### Scenario: Complete single-Bottle review

- **WHEN** a current article has a canonical URL, title, author, explicit date,
  direct tasting section, and valid 100-point score
- **THEN** the system stores one scored review for that Bottle

#### Scenario: Clear non-review article

- **WHEN** a selected article has no direct tasting section
- **THEN** the adapter skips and checkpoints it

#### Scenario: Review-shaped article is incomplete

- **WHEN** a selected article has tasting text but lacks a required fact or a
  valid score
- **THEN** the adapter fails without checkpointing that article

### Requirement: The Whisky Study prose remains transient

The system MUST NOT persist The Whisky Study HTML, full review prose,
publisher images, product background, final thoughts, or comments as source
content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only direct nose, taste, palate, and finish
  paragraphs through the existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link

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

### Requirement: Whiskyfun content remains transient

The system MUST NOT persist Whiskyfun HTML, full review prose, or publisher
images as source content.

#### Scenario: Review text is processed

- **WHEN** the source policy permits Peated to generate a review summary
- **THEN** the adapter passes only that review's text through the existing
  transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link

### Requirement: Words of Whisky current pages use bounded discovery

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

### Requirement: Words of Whisky review sections preserve publisher facts

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

### Requirement: Words of Whisky content remains transient

The system MUST NOT persist Words of Whisky HTML, full review prose, publisher
images, article introductions, or publisher conclusions as source content.

#### Scenario: Review text is processed

- **WHEN** source policy permits Peated to generate a review summary
- **THEN** the adapter passes only that Bottle section's tasting notes through
  the existing transient summary boundary
- **AND** stored output contains only permitted structured facts, derived
  summary data, content hash, and canonical link
