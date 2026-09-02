## ADDED Requirements

### Requirement: Source approval gates publication

The system MUST maintain explicit external-review publication approval for each
source and MUST NOT publish source reviews until a moderator approves it.

#### Scenario: Disabled source is fetched manually

- **WHEN** an admin manually runs a registered review scraper with an enabled
  target and missing publication approval
- **THEN** the scraper may fetch within its request and robots controls
- **AND** ingested reviews remain hidden

#### Scenario: Source is unapproved

- **WHEN** a source adapter fetches an article before publication is approved
- **THEN** the system ingests the review and keeps it hidden

#### Scenario: Approval is removed

- **WHEN** a moderator removes publication approval for a source
- **THEN** public results no longer include reviews from that source
- **AND** manual fetching remains available through the scraper runtime

### Requirement: Review articles own canonical article identity

The system SHALL store each external article once per source by canonical URL
and SHALL allow that article to own multiple Bottle reviews.

#### Scenario: Article reviews several bottles

- **WHEN** an indexed article contains reviews of three distinct bottles
- **THEN** the system stores one review article and three independently
  matchable Bottle reviews

#### Scenario: Article is ingested again

- **WHEN** the same source and canonical URL are ingested with unchanged stable
  review keys
- **THEN** the system updates the existing article and reviews without
  creating duplicates

#### Scenario: Same URL exists at another source

- **WHEN** two sources use the same canonical URL value
- **THEN** each source retains its own article identity

### Requirement: Bottle reviews preserve source score semantics

The system SHALL allow scored and unscored reviews, SHALL preserve the
publisher's native score value, scale, and display text, and MAY derive a
deterministic normalized 0-100 rating for compatibility.

#### Scenario: Decimal ten-point score is ingested

- **WHEN** a publisher assigns a score of `7.8/10`
- **THEN** the review retains `7.8`, `10`, and `7.8/10` while any normalized
  rating is stored separately

#### Scenario: Review has no score

- **WHEN** a review article contains a review without a score
- **THEN** the review remains valid with null native and normalized score
  values

#### Scenario: Bottle page displays a score

- **WHEN** a visible review has an enabled native score
- **THEN** the Bottle page displays the native score rather than the normalized
  compatibility value

### Requirement: Publisher article bodies are transient

The system MUST NOT persist fetched publisher HTML, article bodies, tasting
notes, conclusions, or publisher photography as part of external-review
ingestion.

#### Scenario: Article parsing completes

- **WHEN** extraction finishes
- **THEN** only canonical metadata, structured review facts, content hash,
  and Bottle identity remain stored

#### Scenario: Article processing fails

- **WHEN** extraction raises an error
- **THEN** logs and persisted error state exclude the article body and fetched
  HTML

### Requirement: Bottle identity controls publication

The system SHALL resolve each review through the shared external-review Bottle
identity boundary and MUST NOT automatically publish a review
without one active resolved Bottle.

#### Scenario: Review matches an active Bottle

- **WHEN** a review resolves to an active Bottle and the source is in
  automatic publication mode
- **THEN** the review may become visible on that Bottle page

#### Scenario: Review remains unresolved

- **WHEN** no safe Bottle match exists
- **THEN** the review remains hidden and available to the existing review
  moderation workflow

#### Scenario: Assigned Bottle is retired

- **WHEN** the assigned Bottle is retired or otherwise invalid before commit
- **THEN** the review is not made visible and no partial identity update is
  committed

#### Scenario: Moderator hides an automatically published review

- **WHEN** a moderator hides a matched review and the source later refreshes it
- **THEN** the refresh preserves the hidden state

#### Scenario: Publication approval changes during ingestion

- **WHEN** article ingestion and a publication approval update run concurrently
- **THEN** they serialize so the stored visibility uses one committed approval
  state

### Requirement: Bottle pages send readers to publishers

The Bottle page SHALL present a visible external review with its publisher,
reviewer when known, publication date when known, native score, short review
clip when available, and a prominent canonical link to the full review.

#### Scenario: Complete pilot review is displayed

- **WHEN** a visible review contains all supported metadata
- **THEN** the Bottle page shows that metadata and a clear `Read the full review`
  link naming the publisher

#### Scenario: Optional metadata is absent

- **WHEN** reviewer, publication date, score, or clip is absent
- **THEN** the Bottle page omits that field without inventing a value and still
  provides the publisher link

#### Scenario: Publisher supplies an article date

- **WHEN** a review page provides an explicit publication date
- **THEN** the source adapter stores that date with the review article
- **AND** it does not substitute a sitemap modification date or approximate
  issue season

#### Scenario: Publisher content is rendered

- **WHEN** Peated renders an external review
- **THEN** it does not render the publisher's full review, copied tasting notes,
  conclusion, or photography

### Requirement: Pilot sources are reviewed before automatic publication

The system SHALL keep a new pilot source unapproved for publication until its
extraction and Bottle-matching sample passes the documented rollout gate.

#### Scenario: First source backfill runs

- **WHEN** a pilot source is ingested for the first time
- **THEN** its reviews remain hidden for moderation regardless of resolved
  Bottle identity

#### Scenario: Pilot passes its quality gate

- **WHEN** reviewers confirm at least 90% extraction accuracy, correct
  multi-bottle splitting, and acceptable Bottle-match precision on the agreed
  sample
- **THEN** a moderator may explicitly enable automatic publication for that
  source

### Requirement: Existing external reviews survive migration

The system SHALL migrate existing external reviews to review articles without
changing their Bottle assignments, normalized ratings, canonical links, hidden
state, or public availability.

#### Scenario: Existing Whisky Advocate review is migrated

- **WHEN** the migration processes a current Whisky Advocate review
- **THEN** it creates and links a review article while preserving the review's
  current public behavior and identity without fetching the publisher or
  inventing unknown article metadata

#### Scenario: Migration is verified

- **WHEN** the hard cutover is prepared
- **THEN** review totals, visible Bottle review totals, unresolved totals, and
  canonical URLs match the pre-migration baseline before legacy columns are
  removed
