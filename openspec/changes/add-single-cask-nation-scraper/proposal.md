## Why

Peated does not currently ingest first-party pricing from Single Cask Nation, leaving its limited online-exclusive bottlings dependent on third-party retailer coverage. Its official US shop exposes a small structured collection with current price and availability data suitable for scheduled ingestion.

## What Changes

- Register Single Cask Nation as an external price source and scheduled worker job.
- Scrape the official online-exclusive shop collection into available 700 ml USD whisky listings.
- Preserve bottler identity in normalized listing names and exclude gift cards and unavailable products.
- Fail visibly when the provider payload is malformed or a complete run emits no supported listings.
- Add deterministic parser and routing coverage, an uncached live dry run, and the generated database enum migration.

## Capabilities

### New Capabilities

- `single-cask-nation-price-scraping`: Scheduled ingestion of purchasable whisky bottle prices from Single Cask Nation's official US online shop.

### Modified Capabilities

None.

## Impact

This adds a new `external_site_type` enum value, worker job registration and routing, a Single Cask Nation scraper module, its generated PostgreSQL migration, fixtures, and focused tests. It uses the existing HTTP, normalization, logging, and store-price ingestion boundaries without new dependencies or API changes.
