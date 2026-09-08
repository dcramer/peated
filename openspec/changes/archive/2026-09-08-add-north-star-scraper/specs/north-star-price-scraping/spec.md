## ADDED Requirements

### Requirement: North Star source registration

The system SHALL expose North Star Spirits as an external site whose configured schedule dispatches a dedicated North Star scraper job.

#### Scenario: Scheduled North Star site is due

- **WHEN** a configured North Star external site reaches its next run time
- **THEN** the scheduler dispatches the North Star scraper job

### Requirement: Live whisky listing ingestion

The North Star scraper SHALL validate the public shop payload and submit each available, positively priced whisky product to the existing store-price ingestion pipeline with its normalized name, GBP price in minor units, supported volume, canonical product URL, and optional primary image URL.

#### Scenario: Available whisky product

- **WHEN** the shop feed contains an available whisky product with a positive price
- **THEN** the scraper emits one schema-valid North Star store-price listing for that product

#### Scenario: Product has no explicit supported volume

- **WHEN** an otherwise valid North Star whisky product does not state a supported bottle volume
- **THEN** the scraper emits the listing with North Star's 700 ml default bottle volume

### Requirement: Unsupported listing exclusion

The North Star scraper SHALL exclude products that are unavailable, have no positive price, have an unsupported explicit volume, or are explicitly presented as non-whisky spirits.

#### Scenario: Archived or unavailable product

- **WHEN** a product has no available variant or its available variant has a zero price
- **THEN** the scraper emits no store-price listing for that product

#### Scenario: Explicit gin product

- **WHEN** a product title explicitly identifies the product as gin without identifying it as whisky
- **THEN** the scraper emits no store-price listing for that product

### Requirement: Provider failure visibility

The North Star scraper SHALL fail at the worker boundary when the provider payload is malformed or a complete scrape yields no supported listings.

#### Scenario: Malformed Shopify payload

- **WHEN** the shop endpoint returns a payload that does not satisfy the owned runtime schema
- **THEN** the scraper throws instead of silently treating the response as an empty catalog

#### Scenario: No supported products discovered

- **WHEN** every requested shop page produces zero supported listings
- **THEN** the scraper job fails without marking an empty scrape as successful
