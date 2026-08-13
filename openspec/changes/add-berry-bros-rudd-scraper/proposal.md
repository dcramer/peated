## Why

Peated does not currently ingest first-party pricing from Berry Bros. & Rudd, leaving its own-selection independent bottlings dependent on secondary retailer coverage. Its official UK shop exposes current availability, price, size, and product metadata in a stable server-rendered catalog suitable for scheduled ingestion.

## What Changes

- Register Berry Bros. & Rudd as an external price source and scheduled worker job.
- Scrape the official own-selection Scotch catalog into purchasable 700 ml GBP listings.
- Normalize listing names while preserving Berry Bros. & Rudd bottler identity, canonical product URLs, and official images.
- Exclude unavailable or malformed listings and unsupported bottle sizes with explicit warnings where the provider record is recognizable.
- Fail visibly when a complete run emits no supported listings.
- Add deterministic parser and routing coverage, an uncached live dry run, and the generated database enum migration.

## Capabilities

### New Capabilities

- `berry-bros-rudd-price-scraping`: Scheduled ingestion of purchasable own-selection Scotch whisky prices from Berry Bros. & Rudd's official UK shop.

### Modified Capabilities

None.

## Impact

This adds a new `external_site_type` enum value, worker job registration and routing, a Berry Bros. & Rudd scraper module, its generated PostgreSQL migration, fixtures, and focused tests. It uses the existing HTTP, HTML parsing, normalization, logging, and store-price ingestion boundaries without new dependencies or API changes.
