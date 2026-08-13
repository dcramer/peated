## Why

Peated does not currently collect first-party pricing from Edradour, despite the distillery's official shop carrying an active range of Edradour and Ballechin releases. Adding the source expands direct distillery coverage without relying on a third-party retailer.

## What Changes

- Register Edradour as an external price source and worker job.
- Scrape the official server-rendered shop and product detail pages for purchasable whisky bottles.
- Normalize supported bottle volumes, GBP prices, product URLs, images, and Edradour identity where the source omits it.
- Exclude sold-out products, merchandise, liqueur, and other unsupported products.
- Add fixture-based coverage, local live verification, and a generated database enum migration.

## Capabilities

### New Capabilities

- `edradour-price-scraping`: Collect valid current whisky prices from the official Edradour catalog while rejecting unavailable or unsupported products.

### Modified Capabilities

None.

## Impact

- Adds a new `external_site_type` enum value and generated migration.
- Adds a server worker scraper, routing, fixtures, and tests.
- Reads public Edradour storefront pages; no new runtime dependency or protected credential is required.
