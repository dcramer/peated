## ADDED Requirements

### Requirement: Douglas Laing source registration

The system SHALL register Douglas Laing as an external price source and route configured Douglas Laing sources to the Douglas Laing scraper worker job.

#### Scenario: Scheduled source routing

- **WHEN** the scheduler resolves a configured `douglaslaing` external source
- **THEN** the system selects the Douglas Laing scraper job

### Requirement: Available US-market whisky bottle ingestion

The scraper SHALL paginate Douglas Laing's official US Scotch collection feed and emit available whisky bottles with positive USD prices, canonical US-market product URLs, official images, and provider-tagged 500 ml or 700 ml volumes.

#### Scenario: Supported bottle

- **WHEN** an allowed whisky product type has an exact `Vol: 50` or `Vol: 70` tag and an available positively priced variant
- **THEN** the scraper emits one normalized USD listing with the volume converted to millilitres

#### Scenario: Pagination completion

- **WHEN** the next official collection page contains no products
- **THEN** the scraper stops pagination after processing all preceding supported listings

### Requirement: Non-bottle and unavailable exclusion

The scraper SHALL exclude unavailable records, unsupported product types or volumes, products tagged as whisky gift sets, and products with an explicit numeric ABV below 40 percent.

#### Scenario: Unsupported collection records

- **WHEN** the collection contains merchandise, a gift set, a mini or multipack, an unavailable bottle, or a sub-40-percent prepared drink
- **THEN** the scraper emits no listing for that record

### Requirement: Provider contract failures remain visible

The scraper MUST reject malformed provider payloads and MUST fail a complete run that emits no supported listings.

#### Scenario: Malformed provider payload

- **WHEN** the official feed omits or invalidates a required owned field
- **THEN** the parser raises an error instead of silently accepting the record

#### Scenario: Empty supported result

- **WHEN** a complete scrape produces no supported listings
- **THEN** the scraper reports the existing empty-scrape failure
