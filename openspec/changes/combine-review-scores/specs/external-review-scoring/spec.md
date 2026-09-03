## ADDED Requirements

### Requirement: Moderator-owned source scoring

The system SHALL let moderators preview and save site-level dated conversion rules with source evidence, and SHALL reject stale or invalid changes. Both scraper kinds SHALL use these settings.

#### Scenario: Preview before save

- **WHEN** a moderator proposes a conversion
- **THEN** samples show original and converted values and before/after Bottle scores without saving

#### Scenario: Stale edit

- **WHEN** another moderator saved a newer version
- **THEN** an update using the old version fails without changing settings

### Requirement: Deterministic contributions

The system SHALL preserve native scores and derive contributions with bounded interpolation and integer rounding. Excluded, unsupported, and date-ambiguous scores SHALL not contribute. Unconfigured sites SHALL retain the existing whole-number 100-point rule during rollout.

#### Scenario: Fractional score

- **WHEN** a valid fractional score falls between two mapping points
- **THEN** its contribution is interpolated and rounded once

#### Scenario: Changed publisher rubric

- **WHEN** rules cover different publication periods
- **THEN** each dated review uses only its matching rule and undated reviews do not use dated rules

### Requirement: Existing summaries and public attribution

The system SHALL retain current median, counting, publication, privacy, and Bottle identity rules. It SHALL recompute affected summaries after settings change and expose native scores and contribution status separately.

#### Scenario: Exclude a site

- **WHEN** a moderator excludes a site from scoring
- **THEN** its published reviews remain visible and its scores are removed from Bottle and BottleGroup summaries

#### Scenario: Read a critic review

- **WHEN** a reader views a review scored out of five or ten
- **THEN** its publisher and complete original rating remain visible, with the contribution explained on the bottle page
