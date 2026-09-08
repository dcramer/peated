## Why

Peated does not currently collect first-party pricing from Thompson Bros, despite its official shop carrying a frequently changing range of independent whisky bottlings. Adding the source expands direct bottler coverage without relying on a third-party retailer.

## What Changes

- Register Thompson Bros as an external price source and worker job.
- Scrape the official WooCommerce Store API for in-stock, purchasable whisky bottles.
- Normalize supported bottle volumes, GBP prices, product URLs, images, and Thompson Bros bottler identity.
- Exclude rum and other unsupported products from the combined whisky-and-rum catalog.
- Add fixture-based coverage, local live verification, and a generated database enum migration.

## Capabilities

### New Capabilities

- `thompson-bros-price-scraping`: Collect valid current whisky prices from the official Thompson Bros catalog while rejecting unavailable or unsupported products.

### Modified Capabilities

None.

## Impact

- Adds a new `external_site_type` enum value and generated migration.
- Adds a server worker scraper, routing, fixtures, and tests.
- Reads the public Thompson Bros WooCommerce Store API; no new runtime dependency or protected credential is required.
