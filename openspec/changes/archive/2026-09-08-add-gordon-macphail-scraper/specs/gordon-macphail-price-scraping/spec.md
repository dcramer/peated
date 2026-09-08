## ADDED Requirements

### Requirement: Gordon & MacPhail source registration

The system SHALL expose Gordon & MacPhail as an external site whose configured schedule dispatches a dedicated Gordon & MacPhail scraper job.

#### Scenario: Scheduled Gordon & MacPhail site is due

- **WHEN** a configured Gordon & MacPhail external site reaches its next run time
- **THEN** the scheduler dispatches the Gordon & MacPhail scraper job

### Requirement: Current whisky bottle ingestion

The Gordon & MacPhail scraper SHALL validate the official Shopify catalog and submit each available, positively priced whisky bottle to the existing store-price ingestion pipeline with its normalized name, GBP price in minor units, supported volume, canonical product URL, and optional primary image URL.

#### Scenario: Available whisky bottle

- **WHEN** the catalog contains an available whisky product with a positive concrete price and supported bottle volume
- **THEN** the scraper emits one schema-valid Gordon & MacPhail store-price listing for that product

#### Scenario: Volume appears in official product media

- **WHEN** an otherwise valid bottle omits volume from its title and description but an official product image URL states a supported `ml`, `cl`, or `l` volume
- **THEN** the scraper converts that explicit volume to milliliters and emits the listing

### Requirement: Unsupported listing exclusion

The Gordon & MacPhail scraper SHALL exclude products that are unavailable, have no positive concrete price, are explicitly non-whisky, or do not identify a supported single-bottle volume.

#### Scenario: Unavailable product

- **WHEN** every variant for a product is unavailable
- **THEN** the scraper emits no store-price listing for that product

#### Scenario: Ambiguous or unsupported volume

- **WHEN** a product has no explicit supported single-bottle volume in its title, description, or image URLs
- **THEN** the scraper emits no store-price listing for that product

#### Scenario: Explicitly non-whisky product

- **WHEN** a product title or description explicitly identifies gin, rum, wine, merchandise, or another unsupported product category without identifying whisky
- **THEN** the scraper emits no store-price listing for that product

### Requirement: Provider failure visibility

The Gordon & MacPhail scraper SHALL fail at the worker boundary when the provider payload is malformed or a complete scrape yields no supported listings.

#### Scenario: Malformed Shopify payload

- **WHEN** the catalog returns a payload that does not satisfy the owned runtime schema
- **THEN** the scraper throws instead of silently treating the response as an empty catalog

#### Scenario: No supported products discovered

- **WHEN** every requested catalog page produces zero supported listings
- **THEN** the scraper job fails without marking an empty scrape as successful
