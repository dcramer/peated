## 1. Source Registration

- [x] 1.1 Register `missionliquor` in the external-site type list and worker routing
- [x] 1.2 Verify registered types remain accepted and unknown types remain rejected by application validation

## 2. Scraper Implementation

- [x] 2.1 Implement paginated public Shopify collection fetching and response validation
- [x] 2.2 Parse exact whiskey taxonomy, availability, source size tags, USD prices, product titles, official URLs, and images
- [x] 2.3 Exclude sold-out, multiproduct, promotional, ambiguous, unsupported-volume, inconsistent, and malformed products while retaining complete-run failure

## 3. Verification

- [x] 3.1 Add representative fixtures and focused routing, parsing, exclusion, pagination, and failure tests
- [x] 3.2 Run targeted tests, typecheck, lint, source formatting, and strict OpenSpec validation
- [x] 3.3 Run an uncached live dry run, build the server package, and run the full repository test gate
