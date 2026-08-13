## ADDED Requirements

### Requirement: Fetch the official localized catalog

The Nc'nean scraper SHALL request numbered pages from the official all-products catalog with Great Britain localization and SHALL stop after a page contains no products.

#### Scenario: Catalog page contains products

- **WHEN** a numbered catalog page contains products
- **THEN** the scraper evaluates those products in GBP and requests the next numbered page

#### Scenario: End of catalog

- **WHEN** a numbered catalog page contains no products
- **THEN** the scraper stops requesting additional pages

### Requirement: Emit eligible whisky listings

The scraper SHALL emit only available products with the source's exact whisky taxonomy, one explicit 700 ml description volume, a positive GBP bottle price, recognized Nc'nean vendor identity, valid official product URL, and valid official image.

#### Scenario: Eligible bottle

- **WHEN** a product has the exact whisky tag, no miniature tag, one 70 cl description volume, one valid bottle price, recognized vendor identity, official URL, and valid image
- **THEN** the scraper emits its normalized name, price, GBP currency, 700 ml volume, URL, and image URL

#### Scenario: Unsupported catalog product

- **WHEN** a product is unavailable, non-whisky, a miniature, a gift set, ambiguously variant-priced, or has a missing or unsupported description volume
- **THEN** the scraper does not emit a listing for that product

### Requirement: Resolve optional gift-tube packaging

The scraper SHALL treat Nc'nean's explicitly labeled bottle-only flagship variant as the bottle price and SHALL reject other ambiguous multi-variant products.

#### Scenario: Bottle has optional gift tube

- **WHEN** an eligible product has multiple available variants and exactly one begins with `Without gift tube`
- **THEN** the scraper emits the price of that bottle-only variant

#### Scenario: Multiple variants lack a unique bottle-only option

- **WHEN** an otherwise eligible product has multiple available variants without exactly one recognized bottle-only label
- **THEN** the scraper warns and skips that product

### Requirement: Preserve distillery identity

The scraper SHALL require Nc'nean's exact source-owned vendor identity and SHALL prefix eligible release titles that omit the distillery name.

#### Scenario: Published title has Nc'nean identity

- **WHEN** an eligible title already begins with Nc'nean
- **THEN** the scraper does not duplicate the published identity

#### Scenario: Eligible release title omits identity

- **WHEN** an eligible title omits Nc'nean and its exact vendor identifies Nc'nean Distillery
- **THEN** the scraper prefixes the title with Nc'nean before shared normalization

#### Scenario: Product has unrecognized vendor identity

- **WHEN** an otherwise eligible product does not use the exact Nc'nean Distillery vendor
- **THEN** the scraper warns and skips the product

### Requirement: Degrade individual malformed products visibly

The scraper SHALL log and skip an invalid individual product without aborting valid products from the same catalog page, while retaining the shared complete-run failure when no valid products are emitted.

#### Scenario: One malformed product among valid products

- **WHEN** a catalog page contains a malformed product and at least one valid product
- **THEN** the malformed product is warned about and valid products are emitted

#### Scenario: Invalid catalog payload

- **WHEN** the catalog response itself is not valid source JSON
- **THEN** the scraper fails the run instead of reporting success

#### Scenario: Complete empty run

- **WHEN** the complete paginated run emits no supported listings
- **THEN** the scraper fails explicitly instead of reporting success
