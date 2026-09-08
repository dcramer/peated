## Why

Peated does not currently collect first-party pricing from Edradour, despite the distillery's official shop carrying an active range of Edradour and Ballechin releases. Adding the source expands direct distillery coverage without relying on a third-party retailer.

## What Changes

- Register Edradour as an external price source and worker job.
- Scrape the official server-rendered shop and product detail pages for purchasable whisky bottles.
- Normalize supported bottle volumes, GBP prices, product URLs, images, and Edradour identity where the source omits it.
- Exclude sold-out products, merchandise, liqueur, and other unsupported products.
- Store external-site types as text while retaining the application-owned source-type validator, so future scraper registrations do not require PostgreSQL enum migrations.
- Add fixture-based coverage and local live verification.

## Capabilities

### New Capabilities

- `edradour-price-scraping`: Collect valid current whisky prices from the official Edradour catalog while rejecting unavailable or unsupported products.

### Modified Capabilities

None.

## Impact

- Converts the external-site type column from a PostgreSQL enum to text through a generated migration; API and worker boundaries continue to validate registered source types.
- Adds a server worker scraper, routing, fixtures, and tests.
- Reads public Edradour storefront pages; no new runtime dependency or protected credential is required.
