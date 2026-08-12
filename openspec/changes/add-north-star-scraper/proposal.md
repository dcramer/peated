## Why

Peated's current scraper coverage misses North Star Spirits, a well-known independent bottler whose live shop exposes structured product names, prices, images, and availability. Adding it expands both current UK price coverage and the stream of independent-bottling references entering the existing store-price matching workflow.

## What Changes

- Register North Star Spirits as an external scraper source and scheduled worker job.
- Read its public Shopify shop feed, validate the provider payload, and emit live whisky listings with normalized names, GBP prices, 700 ml default volume, canonical product URLs, and images.
- Ignore unavailable, zero-price, and clearly non-whisky products rather than persisting them as store prices.
- Add fixture-backed parser coverage and focused worker validation.

## Capabilities

### New Capabilities

- `north-star-price-scraping`: Discovery and ingestion of live North Star Spirits whisky listings through Peated's store-price pipeline.

### Modified Capabilities

- None.

## Impact

- `apps/server/src/worker/jobs`: new scraper implementation, registration, and tests.
- `apps/server/src/constants.ts` and worker job routing/types: new external site and job identifiers.
- `apps/server/src/db/schema/externalSites.ts`: generated enum migration for the new external site type.
- `apps/server/__fixtures__/northstarspirits`: representative provider payload used by deterministic tests.
- No new runtime dependency or public API shape is introduced.
