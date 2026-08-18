## ADDED Requirements

### Requirement: Admin-only catalog coverage report

The system SHALL expose the catalog coverage report only to administrators through `GET /admin/catalog/coverage`.

#### Scenario: Administrator requests coverage

- **WHEN** an authenticated administrator requests the catalog coverage report
- **THEN** the system returns the current coverage snapshot

#### Scenario: Non-administrator requests coverage

- **WHEN** an anonymous or non-administrator user requests the catalog coverage report
- **THEN** the system rejects the request as unauthorized

### Requirement: Active bottle content coverage

The report SHALL count active independently complete Bottles and SHALL report how many have a non-blank description and a non-blank image URL. A Bottle is active when it belongs to a BottleGroup and has not been tombstoned.

#### Scenario: Active and inactive bottle rows exist

- **WHEN** the catalog contains active Bottles, a legacy Bottle without a group, and a tombstoned Bottle
- **THEN** only the active non-tombstoned Bottles contribute to `bottles.total` and its content coverage counts

#### Scenario: Blank bottle content exists

- **WHEN** an active Bottle has a null, empty, or whitespace-only description or image URL
- **THEN** that field does not contribute to its corresponding coverage count

### Requirement: Bottle source coverage

The report SHALL count distinct active Bottles with at least one visible matched review and distinct active Bottles with at least one visible matched price listing.

#### Scenario: Multiple visible source items match one bottle

- **WHEN** an active Bottle has multiple visible reviews or price listings
- **THEN** the Bottle contributes exactly once to the corresponding bottle coverage count

#### Scenario: Hidden source item matches a bottle

- **WHEN** a Bottle is supported only by a hidden review or hidden price listing
- **THEN** the Bottle does not contribute to the corresponding bottle coverage count

### Requirement: Source item matching coverage

The report SHALL provide visible review and visible price-listing totals, each split into matched items with a Bottle ID and unmatched items without a Bottle ID.

#### Scenario: Visible matched and unmatched items exist

- **WHEN** visible source items include rows with and without Bottle IDs
- **THEN** the report returns their exact matched and unmatched counts and a total equal to their sum

#### Scenario: Hidden source items exist

- **WHEN** hidden reviews or price listings exist
- **THEN** those items do not contribute to source item totals, matched counts, or unmatched counts
