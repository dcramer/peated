## ADDED Requirements

### Requirement: Source policy gates every operation

The system MUST maintain an explicit external-review policy for each source and
MUST NOT fetch, process with an LLM, display scores, display summaries, or
publish reviews unless the corresponding capability is enabled.

#### Scenario: Disabled source is scheduled

- **WHEN** a scheduled or manually triggered review job targets a disabled
  source
- **THEN** the system refuses network access and records that the source is not
  enabled for fetching

#### Scenario: Summary processing is disabled

- **WHEN** a source policy permits article fetching but not LLM processing
- **THEN** the system ingests permitted metadata without sending article text
  to a model or publishing a generated summary

#### Scenario: Source is disabled

- **WHEN** a moderator disables a source or removes a display capability
- **THEN** future fetching stops and public reviews no longer expose the
  revoked content type

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

### Requirement: Generated summaries are short, attributed, and traceable

The system SHALL treat a generated summary as optional derived data, SHALL
attribute it to its source review, and SHALL record the source content hash,
model, prompt version, and generation time used to create it.

#### Scenario: Enabled summary is generated

- **WHEN** source policy permits LLM processing and summary display and summary
  generation succeeds
- **THEN** the system stores a two- or three-sentence Peated summary with its
  provenance and may display it beside the canonical source link

#### Scenario: Summary generation fails

- **WHEN** extraction succeeds but summary generation fails
- **THEN** permitted review metadata remains ingested and no fabricated or stale
  fallback summary is published

#### Scenario: Review article changes

- **WHEN** an article's content hash changes
- **THEN** its prior generated summaries are not treated as current until they
  are regenerated against the new content

### Requirement: Publisher article bodies are transient

The system MUST NOT persist fetched publisher HTML, article bodies, tasting
notes, conclusions, or publisher photography as part of external-review
ingestion.

#### Scenario: Article processing completes

- **WHEN** extraction and optional summary generation finish
- **THEN** only canonical metadata, structured review facts, content hash,
  Bottle identity, permitted summary, and provenance remain stored

#### Scenario: Article processing fails

- **WHEN** extraction or model processing raises an error
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

#### Scenario: Source policy changes during ingestion

- **WHEN** article ingestion and a publication-mode update run concurrently
- **THEN** they serialize so the stored visibility uses one committed policy
  state

### Requirement: Bottle pages send readers to publishers

The Bottle page SHALL present a visible external review with its publisher,
reviewer when known, publication date when known, enabled native score, short
attributed summary when enabled, and a prominent canonical link to the full
review.

#### Scenario: Complete pilot review is displayed

- **WHEN** a visible review contains all supported metadata
- **THEN** the Bottle page shows that metadata and a clear `Read the full review`
  link naming the publisher

#### Scenario: Optional metadata is absent

- **WHEN** reviewer, publication date, score, or summary is absent or disabled
- **THEN** the Bottle page omits that field without inventing a value and still
  provides the publisher link

#### Scenario: Publisher content is rendered

- **WHEN** Peated renders an external review
- **THEN** it does not render the publisher's full review, copied tasting notes,
  conclusion, or photography

### Requirement: Pilot sources are reviewed before automatic publication

The system SHALL ingest a new pilot source in review-only mode until
its extraction and Bottle-matching sample passes the documented rollout gate.

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
