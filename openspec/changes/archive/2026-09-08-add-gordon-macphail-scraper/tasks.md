## 1. Source Registration

- [x] 1.1 Add the Gordon & MacPhail external-site type and worker job routing/registration.
- [x] 1.2 Generate and inspect the database enum migration from the current main migration chain.

## 2. Scraper Implementation

- [x] 2.1 Implement the provider-shaped Shopify payload parser, price parsing, explicit volume extraction, and listing filters.
- [x] 2.2 Implement the paginated Gordon & MacPhail worker through the shared store-price batching boundary with dry-run support.

## 3. Deterministic Coverage

- [x] 3.1 Add a compact provider fixture covering title- and image-derived volume, images, unavailable records, zero prices, and an explicitly non-whisky product.
- [x] 3.2 Add focused parser and job tests, including registration, malformed payload, pagination, and empty-catalog failure behavior.

## 4. Validation

- [x] 4.1 Format and lint touched files, run focused coexistence tests, apply the full migration chain to a clean test database, and typecheck the server package.
- [x] 4.2 Strictly validate the OpenSpec change and run the worker against the live Shopify catalog in dry-run mode without persistence.
