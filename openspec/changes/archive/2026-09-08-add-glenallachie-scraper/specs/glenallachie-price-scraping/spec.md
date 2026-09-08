## ADDED Requirements

### Requirement: Fetch the official localized catalog

The GlenAllachie scraper SHALL request numbered pages from the official all-products catalog with Great Britain localization and SHALL stop after a page contains no products.

#### Scenario: Catalog page contains products

- **WHEN** a numbered catalog page contains products
- **THEN** the scraper evaluates those products in GBP and requests the next numbered page

#### Scenario: End of catalog

- **WHEN** a numbered catalog page contains no products
- **THEN** the scraper stops requesting additional pages

### Requirement: Emit eligible whisky listings

The scraper SHALL emit only available, full-size products in the source's supported whisky categories with a positive GBP price, recognized brand identity, valid official product URL, and valid official image.

#### Scenario: Eligible bottle

- **WHEN** an available non-miniature product has a supported whisky type, one available positive-price variant, recognized identity, official URL, and valid image
- **THEN** the scraper emits its normalized name, price, GBP currency, 700 ml volume, URL, and image URL

#### Scenario: Unsupported catalog product

- **WHEN** a product is sold out, a miniature, rum, merchandise, a gift card, ambiguously variant-priced, or has an unsupported explicit volume
- **THEN** the scraper does not emit a listing for that product

### Requirement: Preserve producer identity

The scraper SHALL retain a published recognized brand identity and SHALL use the source's Meikle Tòir tag when that identity is omitted from an eligible title.

#### Scenario: Published title has recognized identity

- **WHEN** an eligible product title identifies The GlenAllachie, GlenAllachie, Meikle Tòir, White Heather, or MacNair's
- **THEN** the scraper does not duplicate the published identity

#### Scenario: Meikle Tòir identity is present only in tags

- **WHEN** an eligible title omits a recognized identity and its source tags identify Meikle Tòir
- **THEN** the scraper prefixes the title with `Meikle Tòir` before shared normalization

#### Scenario: Product has no recognized identity

- **WHEN** an otherwise eligible product has neither a recognized title identity nor a recognized identity tag
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
