## 1. Source Registration

- [x] 1.1 Register `thompsonbros` in the external-site type list and worker routing
- [x] 1.2 Generate the PostgreSQL external-site enum migration

## 2. Scraper Implementation

- [x] 2.1 Implement paginated WooCommerce response and per-product validation
- [x] 2.2 Parse and normalize eligible whisky names, supported volumes, GBP prices, official URLs, and images
- [x] 2.3 Exclude rum and unavailable or malformed products while retaining complete-run failure

## 3. Verification

- [x] 3.1 Add representative fixtures and focused routing, parsing, exclusion, pagination, and failure tests
- [x] 3.2 Run targeted tests, typecheck, lint, source formatting, and strict OpenSpec validation
- [x] 3.3 Run an uncached live dry run, build the server package, and run the full repository test gate
