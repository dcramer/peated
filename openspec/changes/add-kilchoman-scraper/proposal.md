## Why

Peated cannot currently ingest direct retail prices from Kilchoman, a well-known Islay distillery with an official online whisky shop. Its public shop page exposes current GBP prices, availability, canonical product links, and official product imagery even though its WooCommerce product API is not currently healthy.

## What Changes

- Add Kilchoman as a configurable external price source.
- Add a worker scraper for Kilchoman's official single-malt shop catalog.
- Emit in-stock, positively priced 700 ml whisky bottles using the exact GBP amount displayed by Kilchoman.
- Exclude sold-out products and gift packs, and fail visibly on malformed candidate cards.
- Add fixture-backed coverage for routing, parsing, filtering, malformed and empty catalogs, and dry-run behavior.
- Add the generated database migration required by the external-site enum.

## Capabilities

### New Capabilities

- `kilchoman-price-scraping`: Fetch and normalize purchasable whisky listings from Kilchoman's official retail shop into Peated store-price inputs.

### Modified Capabilities

None.

## Impact

The change affects the server's external-site enum, generated database migration, scraper worker registration and routing, and worker tests. It adds no runtime dependency and uses the existing HTML parsing and store-price ingestion paths.
