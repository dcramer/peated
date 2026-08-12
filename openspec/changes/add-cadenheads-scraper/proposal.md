## Why

Peated's current scraper coverage misses Cadenhead's, Scotland's oldest independent bottler and a useful source of current single-cask and small-batch whisky listings. Its public online shop exposes structured product, stock, volume, image, and VAT-inclusive GBP price data that can enter the existing store-price matching workflow without granting the source direct catalog mutation privileges.

## What Changes

- Register Cadenhead's as an external scraper source and scheduled worker job.
- Read its public WooCommerce Store API, validate provider payloads, and emit purchasable whisky bottles with normalized names, GBP prices, supported volumes, canonical product URLs, and primary images.
- Exclude unavailable, zero-price, non-bottle, and unsupported-volume products rather than persisting them as store prices.
- Add provider-shaped fixture coverage, focused worker tests, and a read-only live dry-run check.

## Capabilities

### New Capabilities

- `cadenheads-price-scraping`: Discovery and ingestion of current Cadenhead's whisky bottle listings through Peated's store-price pipeline.

### Modified Capabilities

- None.

## Impact

- `apps/server/src/worker/jobs`: new scraper implementation, registration, routing, and tests.
- `apps/server/src/constants.ts`: new external-site identifier.
- `apps/server/src/db/schema/externalSites.ts`: generated enum migration for the new external-site type.
- `apps/server/__fixtures__/cadenheads`: representative WooCommerce provider payload used by deterministic tests.
- No new runtime dependency or public API shape is introduced.
