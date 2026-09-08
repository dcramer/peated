## 1. Source Registration

- [x] 1.1 Add the Douglas Laing external-site enum value, worker job type, registration, and scheduler routing.
- [x] 1.2 Generate the database migration for the external-site enum addition.

## 2. Scraper Implementation

- [x] 2.1 Implement validated parsing and pagination for available USD listings from Douglas Laing's official US Scotch collection feed.
- [x] 2.2 Apply provider-owned product type, volume, gift-set, ABV, availability, price, URL, and image rules at the parser boundary.

## 3. Verification

- [x] 3.1 Add a representative JSON fixture and targeted tests for routing, supported prices and volumes, exclusions, malformed payloads, pagination, and empty-run failure.
- [x] 3.2 Run targeted scraper coexistence tests, typecheck, lint, formatting, and strict OpenSpec validation.
- [x] 3.3 Run an uncached live local dry run against Douglas Laing's official US feed and inspect the emitted listings.
- [x] 3.4 Build the server production target.
