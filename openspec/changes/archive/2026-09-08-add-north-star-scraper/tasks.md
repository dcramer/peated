## 1. Source Registration

- [x] 1.1 Add the North Star external-site type and worker job routing/registration.
- [x] 1.2 Generate and inspect the database enum migration.

## 2. Scraper Implementation

- [x] 2.1 Implement the provider-shaped Shopify payload parser and live listing filters.
- [x] 2.2 Implement the paginated North Star worker through the shared store-price batching boundary.

## 3. Deterministic Coverage

- [x] 3.1 Add a compact North Star provider fixture covering live, unavailable, zero-price, explicit-volume, image, and gin records.
- [x] 3.2 Add focused parser and job tests, including malformed and empty-catalog failure behavior.

## 4. Validation

- [x] 4.1 Format and lint touched files, run the focused server tests, and typecheck the server package.
- [x] 4.2 Run a read-only live-feed parser smoke check and record the supported listing count without persisting production data.
