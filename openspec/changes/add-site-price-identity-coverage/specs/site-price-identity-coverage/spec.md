## ADDED Requirements

### Requirement: Administrators can query one site's price identity coverage

The system SHALL expose a read-only administrator API for the current StorePrice identity coverage of one configured external site.

#### Scenario: Coverage is returned

- **WHEN** an administrator requests identity coverage for a configured external site
- **THEN** the response SHALL contain visible-listing counts for total, exact Bottle matches, unresolved listings, stable source product ids, and source fingerprints

#### Scenario: Hidden listings are excluded

- **WHEN** a site has hidden StorePrice rows
- **THEN** those rows SHALL NOT contribute to any coverage count

#### Scenario: Site does not exist

- **WHEN** an administrator requests coverage for an external-site type without a configured site row
- **THEN** the API SHALL return not found

#### Scenario: Caller is not an administrator

- **WHEN** an unauthenticated or non-administrator caller requests site identity coverage
- **THEN** the API SHALL reject the request

### Requirement: Coverage remains a live aggregate

The system SHALL derive site identity coverage from current StorePrice rows without new reporting persistence or background work.

#### Scenario: Current assignments are counted

- **WHEN** a visible StorePrice gains or loses an exact Bottle assignment, source product id, or source fingerprint
- **THEN** the next coverage request SHALL reflect the current value

#### Scenario: Individual rows need inspection

- **WHEN** an administrator needs to inspect unresolved StorePrice rows
- **THEN** the existing StorePrice list API SHALL remain the drill-down interface
