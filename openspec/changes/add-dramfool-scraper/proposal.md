## Why

Peated does not currently ingest first-party pricing from Dramfool, leaving its independent bottlings dependent on secondary retailer coverage. Dramfool's official shop exposes current bottle variants, stock, GBP prices, product URLs, and images in a public structured catalog suitable for scheduled ingestion.

## What Changes

- Register Dramfool as an external price source and scheduled worker job.
- Scrape the official shop into in-stock full-bottle GBP whisky listings.
- Normalize listing names while preserving Dramfool bottler identity, canonical product URLs, and official images.
- Exclude samples, rum, events, merchandise, unavailable variants, malformed records, and unsupported bottle sizes with explicit warnings where the provider record is recognizable.
- Fail visibly when a complete run emits no supported listings.
- Add deterministic parser and routing coverage, an uncached live dry run, and the generated database enum migration.

## Capabilities

### New Capabilities

- `dramfool-price-scraping`: Scheduled ingestion of purchasable full-bottle whisky prices from Dramfool's official shop.

### Modified Capabilities

None.

## Impact

This adds a new `external_site_type` enum value, worker job registration and routing, a Dramfool scraper module, its generated PostgreSQL migration, fixtures, and focused tests. It uses the existing HTTP, structured parsing, normalization, logging, and store-price ingestion boundaries without new dependencies or API changes.
