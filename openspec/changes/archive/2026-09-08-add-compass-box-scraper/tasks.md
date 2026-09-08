## 1. Source Registration

- [x] 1.1 Add the Compass Box external-site enum value, worker job type, registration, and scheduler routing.
- [x] 1.2 Generate the database migration for the external-site enum addition.

## 2. Scraper Implementation

- [x] 2.1 Implement validated parsing for Compass Box's official shop product cards and regular or sale GBP prices.
- [x] 2.2 Exclude sold-out products and connect the parser to the store-price ingestion path.

## 3. Verification

- [x] 3.1 Add a representative HTML fixture and targeted tests for routing, regular and sale prices, sold-out exclusion, malformed cards, and empty-run failure.
- [x] 3.2 Run targeted coexistence tests, typecheck, lint, formatting, and strict OpenSpec validation.
- [x] 3.3 Run a live local dry run against Compass Box's official shop and inspect the emitted listings.
- [x] 3.4 Build the server production target.
