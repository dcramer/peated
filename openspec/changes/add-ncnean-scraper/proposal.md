## Why

Peated does not collect first-party prices from Nc'nean Distillery, despite its official shop carrying a focused catalog of active organic single malt releases. Adding this source expands direct distillery coverage with structured current GBP data.

## What Changes

- Register Nc'nean as an external price source and scheduled worker job.
- Scrape the official Great Britain-localized Shopify catalog for available full-size whisky bottles.
- Normalize source-owned identity, explicit description volume, GBP price, official product URL, and image.
- Exclude miniatures, gift sets, non-whisky, unavailable, unsupported-volume, ambiguous, and malformed products.
- Handle the flagship's gift-tube packaging options by selecting its explicit bottle-only variant.
- Add fixture-backed coverage and an uncached local live dry run.

## Capabilities

### New Capabilities

- `ncnean-price-scraping`: Collect valid current GBP whisky prices from Nc'nean's official catalog while rejecting unavailable or unsupported products.

### Modified Capabilities

None.

## Impact

- Adds a server worker scraper, routing, fixtures, and tests.
- Reads Nc'nean's public Shopify catalog; no protected credential, runtime dependency, or database migration is required.
