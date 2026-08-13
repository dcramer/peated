## ADDED Requirements

### Requirement: Fetch the official paginated storefront

The Edradour scraper SHALL request numbered pages from the official shop and SHALL stop after a page contains no eligible product cards.

#### Scenario: Catalog page contains products

- **WHEN** a numbered shop page contains purchasable product cards
- **THEN** the scraper evaluates their official product detail pages and requests the next numbered shop page

#### Scenario: End of catalog

- **WHEN** a numbered shop page contains no product cards
- **THEN** the scraper stops requesting additional pages

### Requirement: Emit eligible whisky listings

The scraper SHALL emit only purchasable source products with a supported single-bottle size, an ABV of at least 40 percent, a positive GBP price, and a valid official product URL.

#### Scenario: Eligible bottle

- **WHEN** a purchasable whisky detail has a supported size, qualifying ABV, positive GBP price, official URL, and valid image
- **THEN** the scraper emits its normalized name, price, currency, volume, URL, and image URL

#### Scenario: Unsupported catalog product

- **WHEN** a product is sold out, merchandise, liqueur, zero-priced, below 40 percent ABV, or has an unsupported volume
- **THEN** the scraper does not emit a listing for that product

### Requirement: Preserve distillery product identity

The scraper SHALL retain published Edradour and Ballechin identity and SHALL add Edradour identity when an eligible official product name omits both names.

#### Scenario: Published name identifies Edradour or Ballechin

- **WHEN** an eligible product name begins with `Edradour` or `Ballechin`
- **THEN** the scraper does not duplicate the published identity

#### Scenario: Published name omits distillery identity

- **WHEN** an eligible product name begins with neither `Edradour` nor `Ballechin`
- **THEN** the scraper prefixes the name with `Edradour` before shared normalization

### Requirement: Degrade individual malformed products visibly

The scraper SHALL log and skip an invalid individual product without aborting valid products from the same catalog page, while retaining the shared complete-run failure when no valid products are emitted.

#### Scenario: One malformed product among valid products

- **WHEN** a catalog page contains a malformed product and at least one valid product
- **THEN** the malformed product is warned about and valid products are emitted

#### Scenario: Complete empty run

- **WHEN** the complete paginated run emits no supported listings
- **THEN** the scraper fails explicitly instead of reporting success
