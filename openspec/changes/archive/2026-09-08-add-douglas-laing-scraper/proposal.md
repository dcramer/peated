## Why

Peated does not currently ingest first-party pricing from Douglas Laing, leaving its current regional malts and single-cask bottlings dependent on third-party retailer coverage. Douglas Laing's official US-market Scotch collection exposes a structured catalog suitable for reliable scheduled ingestion.

## What Changes

- Register Douglas Laing as an external price source and scheduled worker job.
- Scrape the official US-market Scotch collection feed into available USD store-price listings for supported 500 ml and 700 ml whisky bottles.
- Exclude unavailable products, unsupported product types and volumes, gift sets, and explicitly sub-40% prepared drinks.
- Fail visibly when the provider payload is malformed or a complete run emits no supported listings.
- Add deterministic parser and routing coverage, an uncached live dry run, and the generated database enum migration.

## Capabilities

### New Capabilities

- `douglas-laing-price-scraping`: Scheduled ingestion of supported, available whisky bottle prices from Douglas Laing's official US storefront.

### Modified Capabilities

None.

## Impact

This adds a new `external_site_type` enum value, worker job registration and routing, a Douglas Laing scraper module, its generated PostgreSQL migration, fixtures, and focused tests. It uses the existing HTTP, normalization, logging, and store-price ingestion boundaries without new dependencies or API changes.
