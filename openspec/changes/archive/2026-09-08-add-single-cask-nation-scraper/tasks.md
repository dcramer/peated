## 1. Source Registration

- [x] 1.1 Add the Single Cask Nation external-site enum value, worker job type, registration, and scheduler routing.
- [x] 1.2 Generate the database migration for the external-site enum addition.

## 2. Scraper Implementation

- [x] 2.1 Implement validated parsing and pagination for available USD listings from Single Cask Nation's official shop collection.
- [x] 2.2 Apply the supported whisky product types, 700 ml shop contract, bottler-prefixed naming, availability, price, URL, and image rules.

## 3. Verification

- [x] 3.1 Add a representative JSON fixture and targeted tests for routing, supported whisky types, exclusions, name normalization, malformed payloads, pagination, and empty-run failure.
- [x] 3.2 Run targeted scraper coexistence tests, typecheck, lint, formatting, and strict OpenSpec validation.
- [x] 3.3 Run an uncached live local dry run against Single Cask Nation's official US shop feed and inspect the emitted listings.
- [x] 3.4 Build the server production target.
