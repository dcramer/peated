## ADDED Requirements

### Requirement: Cadenhead's source registration

The system SHALL expose Cadenhead's as an external site whose configured schedule dispatches a dedicated Cadenhead's scraper job.

#### Scenario: Scheduled Cadenhead's site is due

- **WHEN** a configured Cadenhead's external site reaches its next run time
- **THEN** the scheduler dispatches the Cadenhead's scraper job

### Requirement: Current whisky bottle ingestion

The Cadenhead's scraper SHALL validate the public WooCommerce Store API payload and submit each purchasable, in-stock, positively priced whisky bottle to the existing store-price ingestion pipeline with its normalized name, VAT-inclusive GBP price in minor units, supported volume, canonical product URL, and optional primary image URL.

#### Scenario: Purchasable whisky bottle

- **WHEN** the Store API contains an in-stock, purchasable whisky product with a positive concrete price and supported bottle volume
- **THEN** the scraper emits one schema-valid Cadenhead's store-price listing for that product

#### Scenario: Legacy product has volume only in its name

- **WHEN** an otherwise valid bottle lacks the structured volume attribute but states a supported `ml`, `cl`, or `l` volume in its name
- **THEN** the scraper converts that volume to milliliters and emits the listing

### Requirement: Unsupported listing exclusion

The Cadenhead's scraper SHALL exclude products that are unavailable, not purchasable, have no positive concrete price, or do not identify a supported single-bottle volume.

#### Scenario: Unavailable product

- **WHEN** a product is not both in stock and purchasable
- **THEN** the scraper emits no store-price listing for that product

#### Scenario: Tasting pack or unsupported volume

- **WHEN** a product has no supported single-bottle volume, including a multi-sample tasting pack
- **THEN** the scraper emits no store-price listing for that product

### Requirement: Provider failure visibility

The Cadenhead's scraper SHALL fail at the worker boundary when the provider payload is malformed or a complete scrape yields no supported listings.

#### Scenario: Malformed WooCommerce payload

- **WHEN** the Store API returns a payload that does not satisfy the owned runtime schema
- **THEN** the scraper throws instead of silently treating the response as an empty catalog

#### Scenario: No supported products discovered

- **WHEN** every requested Store API page produces zero supported listings
- **THEN** the scraper job fails without marking an empty scrape as successful
