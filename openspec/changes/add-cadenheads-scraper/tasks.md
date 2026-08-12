## 1. Source Registration

- [x] 1.1 Add the Cadenhead's external-site type and worker job routing/registration.
- [x] 1.2 Generate and inspect the database enum migration.

## 2. Scraper Implementation

- [x] 2.1 Implement the provider-shaped WooCommerce payload parser, entity decoding, volume extraction, and listing filters.
- [x] 2.2 Implement the paginated Cadenhead's worker through the shared store-price batching boundary with dry-run support.

## 3. Deterministic Coverage

- [x] 3.1 Add a compact Cadenhead's provider fixture covering structured and title-derived volume, HTML entities, images, unavailable records, zero prices, and a tasting pack.
- [x] 3.2 Add focused parser and job tests, including registration, malformed payload, pagination, and empty-catalog failure behavior.

## 4. Validation

- [x] 4.1 Format and lint touched files, run the focused server tests, and typecheck the server package.
- [x] 4.2 Strictly validate the OpenSpec change and run the worker against the live Store API in dry-run mode without persistence.
