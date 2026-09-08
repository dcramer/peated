## Why

Peated cannot currently ingest direct retail prices from Compass Box, a leading Scotch whisky blender whose official shop covers core, retired, and limited-edition releases. Its public shop page exposes a curated purchasable subset with current GBP prices, canonical product links, availability, and official imagery.

## What Changes

- Add Compass Box as a configurable external price source.
- Add a worker scraper for Compass Box's official UK and rest-of-world shop page.
- Emit in-stock, positively priced 700 ml whisky bottles using the displayed GBP price.
- Exclude sold-out products and fail visibly on malformed candidate cards.
- Add fixture-backed coverage for routing, parsing, exclusions, malformed cards, and empty-shop failure.
- Add the generated database migration required by the external-site enum.

## Capabilities

### New Capabilities

- `compass-box-price-scraping`: Fetch and normalize purchasable whisky listings from Compass Box's official shop into Peated store-price inputs.

### Modified Capabilities

None.

## Impact

The change affects the server's external-site enum, generated database migration, scraper worker registration and routing, and worker tests. It adds no runtime dependency and uses the existing HTML parsing and store-price ingestion paths.
