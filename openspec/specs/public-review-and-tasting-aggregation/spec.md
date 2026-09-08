## Purpose

Define combined public review-and-tasting summaries and lists while preserving source-specific records.

## Requirements

### Requirement: Shared public participation

The system SHALL treat public tastings, public member reviews, and published
visible critic reviews as one public review-and-tasting set for Bottle-centered
and catalog-centered presentation. It MUST preserve each source record and its
source-specific fields separately.

#### Scenario: Three public sources contribute

- **WHEN** one Bottle has a public tasting, a public member review, and a
  published visible critic review
- **THEN** public combined counts, notes, and lists include all three records

#### Scenario: Private member record

- **WHEN** a private member records a tasting or review
- **THEN** that record does not affect anonymous public aggregates

#### Scenario: Hidden critic review

- **WHEN** a critic review is unpublished, individually hidden, or assigned to
  no active Bottle
- **THEN** that record does not affect public aggregates or lists

### Requirement: Separate rating and note eligibility

The system SHALL use the same three source kinds for ratings and tasting notes,
while counting only records with usable rating data in rating summaries and
only records with recognized tags in flavor denominators.

#### Scenario: Tagged unscored critic review

- **WHEN** a published critic review has recognized tags but no score eligible
  for the Bottle rating summary
- **THEN** its tags contribute to public flavor summaries and it contributes no
  score

#### Scenario: Rated untagged record

- **WHEN** an eligible review or tasting has a rating but no recognized tags
- **THEN** its rating contributes and it does not enter the flavor denominator

### Requirement: Saved Bottle note summaries

The system SHALL save each active Bottle's public combined record count, noted
record count, per-tag counts, and per-category counts. One source record MUST
count at most once for each tag and category.

#### Scenario: Several notes in one category

- **WHEN** one record contains smoke and ash and both belong to the smoke
  category
- **THEN** both tag counts increase once and the smoke category count increases
  once

#### Scenario: Summary recomputation

- **WHEN** `UpdateBottleStats` recomputes a Bottle
- **THEN** its rating, combined count, tag, and category summaries are replaced
  together from authoritative source records

### Requirement: Summary-backed aggregate reads

The system SHALL use saved Bottle summaries for public flavor charts, tag
suggestions, tag filters, tag rankings, counts, and popularity sorting. These
reads MUST NOT aggregate all source records at request time.

#### Scenario: List Bottles for a tag

- **WHEN** a reader requests Bottles associated with a tasting-note tag or
  category
- **THEN** the result and its ranking are calculated from saved per-Bottle tag
  and category summaries

#### Scenario: Browse popular Bottles

- **WHEN** a public Bottle catalog is sorted by review-and-tasting activity
- **THEN** it orders by the saved combined public count

### Requirement: Combined public lists

The system SHALL provide stable chronological Bottle, Entity, and global lists
that interleave eligible tastings, member reviews, and critic reviews.

#### Scenario: Bottle list

- **WHEN** a reader opens a Bottle's reviews-and-tastings list
- **THEN** all three eligible source kinds appear in one chronological list

#### Scenario: Authorized private activity

- **WHEN** a signed-in reader may view a private member's activity
- **THEN** the combined row-level list includes that activity without adding it
  to anonymous public aggregate counts

### Requirement: Accurate public names

The system SHALL call combined public values and lists “reviews and tastings”
and SHALL keep tasting-only values named as tastings.

#### Scenario: Compatibility route

- **WHEN** an existing Bottle or Entity `/tastings` URL is opened
- **THEN** it remains valid and presents the combined list as “Reviews &
  tastings”

#### Scenario: Existing totalTastings field

- **WHEN** a caller reads `totalTastings`
- **THEN** it continues to represent only tasting records

### Requirement: Source-specific exceptions

The system MUST keep profile, personal-history, recommendation, badge, comment,
flight, notification, and moderation behavior source-specific where their
existing rules require one record kind.

#### Scenario: Member profile

- **WHEN** a reader opens a member's tasting history or tasting statistics
- **THEN** critic reviews and unrelated member records are not added

#### Scenario: Recommendations

- **WHEN** the recommendation job calculates member overlap
- **THEN** it continues to use qualifying member tastings only

### Requirement: Complete invalidation

The system SHALL queue affected Bottle summary recomputations after source
writes, critic publication changes, member privacy changes, tag taxonomy
changes, Bottle reassignment, and Bottle merges.

#### Scenario: Member becomes private

- **WHEN** a member changes from public to private
- **THEN** every Bottle with one of that member's tastings or reviews is queued
  for summary recomputation

#### Scenario: Publication stops

- **WHEN** a critic source stops publication
- **THEN** affected Bottle summaries are queued and later exclude its reviews
