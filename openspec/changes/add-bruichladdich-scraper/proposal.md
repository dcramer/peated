## Why

Peated does not currently collect first-party prices from Bruichladdich Distillery, despite its official shop carrying active Bruichladdich, Port Charlotte, and Octomore releases. Adding this source expands direct distillery coverage with stable structured product data instead of relying on a general retailer.

## What Changes

- Register Bruichladdich as an external price source and scheduled worker job.
- Scrape the official Great Britain-localized Shopify catalog for available whisky bottles.
- Normalize published brand identity, explicit bottle volume, GBP price, official product URL, and image.
- Exclude unavailable, zero-price, non-whisky, unsupported-volume, ambiguous, and malformed products.
- Add fixture-backed coverage and an uncached local live dry run.

## Capabilities

### New Capabilities

- `bruichladdich-price-scraping`: Collect valid current GBP whisky prices from the official Bruichladdich catalog while rejecting unavailable or unsupported products.

### Modified Capabilities

None.

## Impact

- Adds a server worker scraper, routing, fixtures, and tests.
- Reads Bruichladdich's public Shopify catalog; no protected credential, runtime dependency, or database migration is required.
