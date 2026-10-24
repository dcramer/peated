## ADDED Requirements

### Requirement: Removed ratings do not contribute

The system SHALL exclude moderator-removed member reviews, external reviews, and tastings from every Bottle and BottleGroup rating summary. Removal and restoration SHALL queue recomputation for the affected active Bottle after the moderation transaction commits.

#### Scenario: Scored member review is removed

- **WHEN** an administrator removes a member review with a score
- **THEN** the review no longer contributes to member score count, median, minimum, maximum, score bands, or distinct rater count after recomputation

#### Scenario: Rated tasting is removed

- **WHEN** an administrator removes a band-rated tasting
- **THEN** the tasting no longer contributes to its tasting band or distinct rater count after recomputation

#### Scenario: Scored critic review is removed

- **WHEN** an administrator removes a critic review whose score otherwise qualifies
- **THEN** the review no longer contributes to external score count, median, minimum, maximum, score bands, or distinct critic count after recomputation

#### Scenario: Removed rating is restored

- **WHEN** an administrator restores a removed review or tasting whose rating remains eligible
- **THEN** the record contributes again after recomputation under its ordinary privacy, publication, Bottle, and scoring rules

#### Scenario: Removed critic review has no Bottle

- **WHEN** an administrator removes or restores an unmatched critic review
- **THEN** the state and history change succeeds without queueing summary work for an invented Bottle

### Requirement: Removed tastings do not affect recommendations

The system SHALL exclude moderator-removed tastings from recommendation member overlap and all tasting-only rating totals.

#### Scenario: Qualifying tasting is removed

- **WHEN** a removed tasting was one member's Outstanding or Unicorn evidence for a Bottle pair
- **THEN** that tasting does not qualify the member for recommendation overlap

#### Scenario: Qualifying tasting is restored

- **WHEN** the tasting is restored and remains otherwise eligible
- **THEN** it can qualify the member again under the existing recommendation rules
