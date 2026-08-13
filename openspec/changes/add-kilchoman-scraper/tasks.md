## 1. Source Registration

- [x] 1.1 Add the Kilchoman external-site enum value, worker job type, registration, and scheduler routing.
- [x] 1.2 Generate the database migration for the external-site enum addition.

## 2. Scraper Implementation

- [x] 2.1 Implement validated parsing for Kilchoman's official shop product cards and displayed GBP prices.
- [x] 2.2 Exclude sold-out and unsupported products and connect the parser to the store-price ingestion path.

## 3. Verification

- [x] 3.1 Add a representative HTML fixture and targeted tests for routing, valid listings, exclusions, malformed cards, and empty-run failure.
- [x] 3.2 Run targeted tests, typecheck, lint, formatting, and strict OpenSpec validation.
- [x] 3.3 Run a live local dry run against Kilchoman's official shop and inspect the emitted listings.
