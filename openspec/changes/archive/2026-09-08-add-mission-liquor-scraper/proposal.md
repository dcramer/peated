## Why

Peated's recent scraper additions cover focused distilleries and bottlers but do not add broad catalog coverage. Mission Wine & Spirits publishes a public catalog of more than 2,500 whiskies, including major American, Scotch, Irish, Japanese, and world-whisky brands, with structured current USD prices.

## What Changes

- Register Mission Liquor as an external price source and scheduled worker job.
- Scrape its public paginated whiskey collection for available single-bottle products.
- Normalize explicit source size tags, current USD price, product URL, title, and official image.
- Exclude sold-out products, bundles, gift sets, multipacks, unsupported sizes, and malformed records.
- Add fixture-backed coverage and an uncached local live dry run.

## Capabilities

### New Capabilities

- `mission-liquor-price-scraping`: Collect valid current USD whiskey prices from Mission Liquor's broad public catalog while rejecting unavailable or ambiguous products.

### Modified Capabilities

None.

## Impact

- Adds a server worker scraper, routing, fixtures, and tests.
- Reads Mission Liquor's public Shopify collection; no protected credential, runtime dependency, or database migration is required.
