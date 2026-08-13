## Why

Peated cannot currently ingest direct retail prices from Gordon & MacPhail, one of the best-known independent Scotch whisky bottlers. Their official Shopify storefront exposes a stable public catalog with current GBP prices and availability, making it a useful first-party source.

## What Changes

- Add Gordon & MacPhail as a configurable external price source.
- Add a worker scraper for the official Shopify product catalog.
- Validate catalog payloads and emit only available, positive-price bottles with an explicit supported volume.
- Add fixture-backed coverage for routing, parsing, filtering, malformed payloads, pagination, and empty-catalog failure.
- Add the generated database migration required by the external-site enum.

## Capabilities

### New Capabilities

- `gordon-macphail-price-scraping`: Fetch and normalize purchasable whisky listings from Gordon & MacPhail's official retail shop into Peated store-price inputs.

### Modified Capabilities

None.

## Impact

The change affects the server's external-site enum, generated database migration, scraper worker registration and routing, and worker tests. It adds no runtime dependency and uses the existing Shopify JSON catalog and store-price ingestion path.
