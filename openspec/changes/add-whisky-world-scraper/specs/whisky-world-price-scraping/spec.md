## ADDED Requirements

### Requirement: Fetch the official 70 cl catalog

The Whisky World scraper SHALL request numbered pages from the official exact 70 cl whisky facet with the source's supported page size and SHALL stop after a page contains no product cards.

#### Scenario: Catalog page contains products

- **WHEN** a numbered 70 cl catalog page contains product cards
- **THEN** the scraper evaluates those cards as 700 ml GBP offers and requests the next numbered page

#### Scenario: End of catalog

- **WHEN** a numbered catalog page contains no product cards
- **THEN** the scraper stops requesting additional pages

### Requirement: Emit directly buyable bottle listings

The scraper SHALL emit only cards with the source's exact direct-buy action, a positive GBP bottle price, a valid official product URL, and a valid official image.

#### Scenario: Eligible bottle

- **WHEN** a 70 cl product card is directly buyable and has a positive GBP price, official product URL, and official image
- **THEN** the scraper emits its normalized name, price, GBP currency, 700 ml volume, URL, and image URL

#### Scenario: Non-buyable catalog product

- **WHEN** a product card does not expose the source's direct-buy action
- **THEN** the scraper does not emit a listing for that card

### Requirement: Reject multiproduct offers

The scraper SHALL reject titles that clearly identify gift sets or packs, tasting sets or packs, bundles, advent calendars, miniature sets or packs, numeric packs, numeric multi-bottle volumes, or `set of N` offers.

#### Scenario: Clear multiproduct title

- **WHEN** an otherwise valid product title identifies a supported multiproduct pattern
- **THEN** the scraper does not emit a listing for that product

#### Scenario: Generic release word is not a pack

- **WHEN** an otherwise eligible bottle uses a word such as `collection`, `case`, `box`, `duo`, or `trio` without pack syntax
- **THEN** the scraper does not exclude it solely for that word

### Requirement: Validate official listing identity

The scraper MUST require product and image URLs to resolve to The Whisky World's HTTPS origin and MUST require product paths to include the provider's numeric product identity.

#### Scenario: Lazy-loaded official image

- **WHEN** an eligible card contains a placeholder source and an official lazy-loaded image URL
- **THEN** the scraper emits the official lazy-loaded image URL

#### Scenario: Untrusted listing URL

- **WHEN** a product or image URL resolves outside the official origin or the product path lacks its numeric identity
- **THEN** the scraper warns and skips that card

### Requirement: Degrade individual malformed cards visibly

The scraper SHALL log and skip an invalid individual card without aborting valid cards from the same catalog page, MUST fail a page that contains cards but no supported listings, and SHALL retain the shared complete-run failure when the catalog contains no cards.

#### Scenario: One malformed card among valid cards

- **WHEN** a catalog page contains a malformed card and at least one valid card
- **THEN** the malformed card is warned about and valid cards are emitted

#### Scenario: Product cards yield no supported listings

- **WHEN** a catalog page contains product cards but none can be emitted
- **THEN** the scraper fails the page instead of silently ending pagination

#### Scenario: Complete empty run

- **WHEN** the complete paginated run emits no supported listings
- **THEN** the scraper fails explicitly instead of reporting success
