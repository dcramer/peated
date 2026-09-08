## ADDED Requirements

### Requirement: Single Cask Nation source registration

The system SHALL register Single Cask Nation as an external price source and route configured Single Cask Nation sources to its scraper worker job.

#### Scenario: Scheduled source routing

- **WHEN** the scheduler resolves a configured `singlecasknation` external source
- **THEN** the system selects the Single Cask Nation scraper job

### Requirement: Available online-exclusive whisky ingestion

The scraper SHALL paginate Single Cask Nation's official US shop collection and emit available supported whisky products with positive USD prices, 700 ml volume, bottler-prefixed normalized names, canonical product URLs, and official images.

#### Scenario: Supported shop bottle

- **WHEN** an allowed whisky product type has an available positively priced variant
- **THEN** the scraper emits one normalized 700 ml USD listing prefixed with `Single Cask Nation`

#### Scenario: Pagination completion

- **WHEN** the next official collection page contains no products
- **THEN** the scraper stops pagination after processing all preceding supported listings

### Requirement: Unsupported and unavailable exclusion

The scraper SHALL exclude unavailable products and records whose product type is not one of the supported whisky types.

#### Scenario: Gift card or unavailable product

- **WHEN** the shop collection contains a gift card or a product without an available positively priced variant
- **THEN** the scraper emits no listing for that record

### Requirement: Provider contract failures remain visible

The scraper MUST reject malformed provider payloads and MUST fail a complete run that emits no supported listings.

#### Scenario: Malformed provider payload

- **WHEN** the official feed omits or invalidates a required owned field
- **THEN** the parser raises an error instead of silently accepting the record

#### Scenario: Empty supported result

- **WHEN** a complete scrape produces no supported listings
- **THEN** the scraper reports the existing empty-scrape failure
