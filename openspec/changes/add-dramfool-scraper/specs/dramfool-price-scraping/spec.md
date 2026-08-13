## ADDED Requirements

### Requirement: Dramfool source registration

The system SHALL register Dramfool as an external price source and route configured Dramfool sources to its scraper worker job.

#### Scenario: Scheduled source routing

- **WHEN** the scheduler resolves a configured `dramfool` external source
- **THEN** the system selects the Dramfool scraper job

### Requirement: Purchasable full-bottle whisky ingestion

The scraper SHALL process Dramfool's official structured shop catalog and emit in-stock full-bottle variants with positive GBP prices, supported bottle volumes, normalized names, canonical product URLs, and official images when present.

#### Scenario: Purchasable full-bottle variant

- **WHEN** a physical shop item has a variant with positive inventory or unlimited inventory, a positive GBP price, a supported structured size, a title, and a product URL
- **THEN** the scraper emits one normalized GBP listing using the variant price and official product metadata

#### Scenario: Active sale price

- **WHEN** an eligible variant is marked on sale and has a positive GBP sale price
- **THEN** the scraper emits the active sale price instead of the regular price

#### Scenario: Equivalent structured volume formats

- **WHEN** a supported bottle size is represented using `ml`, `cl`, or `l` notation with optional whitespace and case differences
- **THEN** the scraper converts it to the equivalent integer milliliter volume

#### Scenario: Source identity omitted from title

- **WHEN** an eligible release title does not already contain `Dramfool`
- **THEN** the scraper prefixes the title with `Dramfool` before normalization

#### Scenario: Collection completion

- **WHEN** the scraper finishes processing the single structured catalog response
- **THEN** it returns no records for subsequent shared pagination callbacks

### Requirement: Ineligible variant exclusion

The scraper SHALL exclude unavailable variants, samples and unsupported sizes, records without an explicit structured size, non-positive or non-GBP prices, malformed required product fields, and non-physical products.

#### Scenario: Unavailable variant

- **WHEN** a variant is not unlimited and has no positive inventory
- **THEN** the scraper emits no listing for that variant

#### Scenario: Missing or unsupported size

- **WHEN** a recognizable product variant lacks an explicit structured size or its parsed volume is outside Peated's supported values
- **THEN** the scraper emits no listing for that variant and logs a scrape warning with available identifying context

#### Scenario: Invalid provider record

- **WHEN** a recognizable product has an invalid price, currency, URL, title, or other required metadata
- **THEN** the scraper emits no listing for that record and logs a scrape warning with available identifying context

### Requirement: Complete provider failure remains visible

The scraper MUST fail a complete run that emits no supported listings.

#### Scenario: Empty supported result

- **WHEN** a complete scrape produces no supported listings
- **THEN** the scraper reports the existing empty-scrape failure
