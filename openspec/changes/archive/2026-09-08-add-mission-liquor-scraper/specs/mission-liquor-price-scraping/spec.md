## ADDED Requirements

### Requirement: Fetch the official paginated catalog

The Mission Liquor scraper SHALL request numbered pages from the official whiskey collection with the source's maximum page size and SHALL stop after a page contains no products.

#### Scenario: Catalog page contains products

- **WHEN** a numbered catalog page contains products
- **THEN** the scraper evaluates those products in USD and requests the next numbered page

#### Scenario: End of catalog

- **WHEN** a numbered catalog page contains no products
- **THEN** the scraper stops requesting additional pages

### Requirement: Emit eligible whiskey listings

The scraper SHALL emit only products with the exact whiskey taxonomy, exactly one available variant, one supported source size tag, a positive USD bottle price, a valid official product URL, and a valid official image.

#### Scenario: Eligible bottle

- **WHEN** a product has exact whiskey taxonomy, one available variant, one supported size tag, a valid bottle price, official URL, and valid image
- **THEN** the scraper emits its normalized name, price, USD currency, parsed volume, URL, and image URL

#### Scenario: Unsupported catalog product

- **WHEN** a product is sold out, non-whiskey, ambiguously variant-priced, unsupported in size, or missing required source metadata
- **THEN** the scraper does not emit a listing for that product

### Requirement: Reject multiproduct and inconsistent offers

The scraper SHALL reject gift sets, tasting sets, samplers, bundles, numeric multipacks, promotional placeholders, and products whose explicit title volume disagrees with their source size tag.

#### Scenario: Multiproduct offer

- **WHEN** a product title or size tag identifies a gift set, tasting set, sampler, bundle, or numeric multipack
- **THEN** the scraper does not emit a listing for that product

#### Scenario: Generic release word is not a pack

- **WHEN** an otherwise eligible bottle uses a word such as `case` as part of its release name without pack syntax
- **THEN** the scraper does not exclude it solely for that word

#### Scenario: Source sizes disagree

- **WHEN** a product's explicit title volume differs from its parsed source size tag
- **THEN** the scraper warns and skips that product

### Requirement: Normalize source listings

The scraper SHALL remove a matching terminal size label from an eligible product title before shared bottle-name normalization while preserving release identity and other qualifiers.

#### Scenario: Title ends in bottle size

- **WHEN** an eligible product title ends with its matching bottle size, optionally before a trailing qualifier
- **THEN** the scraper removes the size label and preserves the remaining title for shared normalization

#### Scenario: Title omits bottle size

- **WHEN** an eligible product title has no explicit volume and its source size tag is valid
- **THEN** the scraper preserves the title and uses the source size tag for volume

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
