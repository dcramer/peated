## ADDED Requirements

### Requirement: Kilchoman source registration

The system SHALL expose Kilchoman as an external site whose configured schedule dispatches a dedicated Kilchoman scraper job.

#### Scenario: Scheduled Kilchoman site is due

- **WHEN** a configured Kilchoman external site reaches its next run time
- **THEN** the scheduler dispatches the Kilchoman scraper job

### Requirement: Current Kilchoman bottle ingestion

The Kilchoman scraper SHALL parse the official single-malt shop and submit each purchasable bottle to the existing store-price ingestion pipeline with its normalized name, displayed GBP price in minor units, 700 ml volume, canonical product URL, and official image URL.

#### Scenario: Purchasable whisky bottle

- **WHEN** the shop contains a non-sold-out whisky bottle card with a positive concrete price and required product metadata
- **THEN** the scraper emits one schema-valid Kilchoman store-price listing for that product

#### Scenario: Visitor-specific tax display

- **WHEN** Kilchoman labels a product amount as excluding tax for the scraper's visitor location
- **THEN** the scraper records that exact displayed amount without estimating a tax-inclusive price

### Requirement: Unsupported listing exclusion

The Kilchoman scraper SHALL exclude sold-out products and gift packs.

#### Scenario: Sold-out release

- **WHEN** a product card is marked sold out
- **THEN** the scraper emits no store-price listing for that product

#### Scenario: Gift pack

- **WHEN** a product card identifies a gift pack rather than a single bottle
- **THEN** the scraper emits no store-price listing for that product

### Requirement: Provider failure visibility

The Kilchoman scraper SHALL fail at the worker boundary when a candidate product card is malformed or a complete scrape yields no supported listings.

#### Scenario: Malformed product card

- **WHEN** a non-sold-out candidate card lacks a non-empty name, valid canonical URL, positive parsable price, or valid official image URL
- **THEN** the scraper throws instead of silently omitting the card

#### Scenario: No supported products discovered

- **WHEN** the complete shop page produces zero supported listings
- **THEN** the scraper job fails without marking an empty scrape as successful
