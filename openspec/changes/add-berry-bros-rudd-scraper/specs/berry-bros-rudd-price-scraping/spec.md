## ADDED Requirements

### Requirement: Berry Bros. & Rudd source registration

The system SHALL register Berry Bros. & Rudd as an external price source and route configured Berry Bros. & Rudd sources to its scraper worker job.

#### Scenario: Scheduled source routing

- **WHEN** the scheduler resolves a configured `berrybrosrudd` external source
- **THEN** the system selects the Berry Bros. & Rudd scraper job

### Requirement: Purchasable own-selection Scotch ingestion

The scraper SHALL paginate Berry Bros. & Rudd's official UK own-selection Scotch catalog and emit purchasable listings with positive GBP prices, supported bottle volumes, normalized names, canonical product URLs, and official images when present.

#### Scenario: Purchasable own-selection bottle

- **WHEN** a catalog card has an add-to-basket action, a positive displayed price, a supported displayed volume, a title, and a product URL
- **THEN** the scraper emits one normalized GBP listing using the current displayed price and official product metadata

#### Scenario: Equivalent displayed volume formats

- **WHEN** a supported bottle size is displayed using `ml`, `cl`, or `l` notation with optional whitespace
- **THEN** the scraper converts it to the equivalent integer milliliter volume

#### Scenario: Responsive duplicate markup

- **WHEN** the provider renders desktop and horizontal presentations for the same search result
- **THEN** the scraper parses the fully populated desktop card once

#### Scenario: Pagination completion

- **WHEN** the next official catalog page contains no eligible desktop product cards
- **THEN** the scraper stops pagination after processing all preceding supported listings

### Requirement: Ineligible listing exclusion

The scraper SHALL exclude unavailable listings, non-positive or invalid prices, malformed required product fields, and unsupported bottle volumes.

#### Scenario: Unavailable listing

- **WHEN** a catalog card does not offer an add-to-basket action
- **THEN** the scraper emits no listing for that card

#### Scenario: Invalid or unsupported record

- **WHEN** a recognizable desktop product card has an invalid price, missing required product metadata, or a volume outside Peated's supported values
- **THEN** the scraper emits no listing for that card and logs a scrape warning with available identifying context

### Requirement: Complete provider failure remains visible

The scraper MUST fail a complete run that emits no supported listings.

#### Scenario: Empty supported result

- **WHEN** a complete scrape produces no supported listings
- **THEN** the scraper reports the existing empty-scrape failure
