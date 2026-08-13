## ADDED Requirements

### Requirement: Compass Box source registration

The system SHALL expose Compass Box as an external site whose configured schedule dispatches a dedicated Compass Box scraper job.

#### Scenario: Scheduled Compass Box site is due

- **WHEN** a configured Compass Box external site reaches its next run time
- **THEN** the scheduler dispatches the Compass Box scraper job

### Requirement: Current Compass Box bottle ingestion

The Compass Box scraper SHALL parse the official UK/rest-of-world shop and submit each available whisky bottle to the existing store-price ingestion pipeline with its normalized Compass Box name, displayed GBP price in minor units, 700 ml volume, canonical product URL, and official image URL.

#### Scenario: Available regular-price bottle

- **WHEN** the shop contains a non-sold-out bottle card with a positive regular price and required product metadata
- **THEN** the scraper emits one schema-valid Compass Box store-price listing for that product

#### Scenario: Available sale-price bottle

- **WHEN** an available bottle card identifies an active sale price
- **THEN** the scraper records the displayed sale price rather than the crossed-out regular price

### Requirement: Sold-out listing exclusion

The Compass Box scraper SHALL exclude product cards marked sold out.

#### Scenario: Sold-out release

- **WHEN** a product card is marked sold out
- **THEN** the scraper emits no store-price listing for that product

### Requirement: Provider failure visibility

The Compass Box scraper SHALL fail at the worker boundary when an available candidate product card is malformed or a complete scrape yields no supported listings.

#### Scenario: Malformed product card

- **WHEN** an available candidate card lacks a non-empty name, valid canonical URL, positive parsable price, or valid official image URL
- **THEN** the scraper throws instead of silently omitting the card

#### Scenario: No supported products discovered

- **WHEN** the complete shop page produces zero supported listings
- **THEN** the scraper job fails without marking an empty scrape as successful
