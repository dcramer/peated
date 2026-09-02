## ADDED Requirements

### Requirement: Scraped reviews can have a short clip

The system SHALL accept the text for one scraped external review and SHALL use
a low-cost model to create one clip of at most 180 characters.

#### Scenario: Review text produces a clip

- **WHEN** a review adapter supplies text for one external review
- **THEN** the system stores the returned clip with that review

#### Scenario: Article contains several Bottle reviews

- **WHEN** one article contains text for several Bottle reviews
- **THEN** each model call receives only the text assigned to that review's
  stable source key

### Requirement: Clip generation is optional

The system MUST store valid external review facts when clip generation cannot
produce a result.

#### Scenario: Model request fails

- **WHEN** the clip model request fails
- **THEN** review ingestion continues without a new clip
- **AND** an existing stored clip is not erased

#### Scenario: Review has no source text

- **WHEN** an adapter does not supply text for a review
- **THEN** the system stores the review without a new clip

### Requirement: Clip generation has one global switch

The system SHALL allow operators to stop all new external review clip model
calls without changing review publication.

#### Scenario: Clip generation is disabled

- **WHEN** the global clip setting is disabled
- **THEN** the system makes no clip model request
- **AND** review ingestion continues normally
- **AND** stored clips remain available

### Requirement: Public review views show available clips

The system SHALL return a stored clip with an external review and SHALL omit it
when no clip is stored.

#### Scenario: Bottle review has a clip

- **WHEN** a public external review has a stored clip
- **THEN** its Bottle review card shows the clip beside the publisher link

#### Scenario: Community review has no clip

- **WHEN** a community feed review has no stored clip
- **THEN** the feed continues to use the article title as its description

### Requirement: Complete source text remains temporary

The system MUST NOT store complete external review text as part of clip
generation.

#### Scenario: Clip generation finishes

- **WHEN** clip generation succeeds or fails
- **THEN** only normal review facts and any successful short clip remain in
  storage
