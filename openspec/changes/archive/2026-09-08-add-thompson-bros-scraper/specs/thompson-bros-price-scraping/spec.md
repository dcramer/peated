## ADDED Requirements

### Requirement: Fetch the official paginated catalog

The Thompson Bros scraper SHALL request the public WooCommerce Store API for the combined whisky-and-rum category, restricted to in-stock products, and SHALL process pages until the source returns an empty page.

#### Scenario: Multiple catalog pages

- **WHEN** a catalog page returns products
- **THEN** the scraper processes eligible listings and requests the next numbered page

#### Scenario: End of catalog

- **WHEN** a catalog page returns an empty array
- **THEN** the scraper stops requesting additional pages

### Requirement: Emit eligible whisky listings

The scraper SHALL emit only source records that are in stock, purchasable, priced in positive GBP minor units, have a supported single-bottle volume expressed in flexible `ml`, `cl`, or `l` notation, and have a valid official product URL.

#### Scenario: Eligible bottle

- **WHEN** a purchasable in-stock whisky has a supported volume, positive GBP price, official URL, and image
- **THEN** the scraper emits its normalized name, price, currency, volume, URL, and image URL

#### Scenario: Active source exclusion

- **WHEN** a product is rum, unavailable, unpurchasable, zero-priced, non-GBP, or has an unsupported volume
- **THEN** the scraper does not emit a listing for that product

### Requirement: Preserve Thompson Bros bottler identity

The scraper SHALL include Thompson Bros identity in every emitted bottle name before applying shared bottle normalization.

#### Scenario: Source name omits bottler

- **WHEN** an eligible product name does not already identify Thompson Bros
- **THEN** the scraper prefixes the name with `Thompson Bros`

#### Scenario: Source name includes bottler

- **WHEN** an eligible product name already identifies Thompson Bros
- **THEN** the scraper does not duplicate the bottler name

### Requirement: Degrade individual malformed records visibly

The scraper SHALL log and skip an invalid individual product record without aborting valid records from the same catalog page, while retaining the shared complete-run failure when no valid products are emitted.

#### Scenario: One malformed product among valid products

- **WHEN** a catalog page contains a malformed product and at least one valid product
- **THEN** the malformed product is warned about and valid products are emitted

#### Scenario: Invalid top-level response

- **WHEN** the Store API response is not an array
- **THEN** the scraper rejects the response

#### Scenario: Complete empty run

- **WHEN** the complete paginated run emits no supported listings
- **THEN** the scraper fails explicitly instead of reporting success
