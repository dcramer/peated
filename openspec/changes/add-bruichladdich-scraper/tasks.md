## 1. Source Registration

- [x] 1.1 Register `bruichladdich` in the external-site type list and worker routing
- [x] 1.2 Verify registered types remain accepted and unknown types remain rejected by application validation

## 2. Scraper Implementation

- [x] 2.1 Implement Great Britain-localized paginated Shopify catalog fetching and response validation
- [x] 2.2 Parse and normalize supported brand identities, explicit 700 ml variants, GBP prices, official URLs, and images
- [x] 2.3 Exclude unavailable, zero-price, non-whisky, ambiguous, unsupported-volume, and malformed products while retaining complete-run failure

## 3. Verification

- [x] 3.1 Add representative fixtures and focused routing, parsing, exclusion, pagination, and failure tests
- [x] 3.2 Run targeted tests, typecheck, lint, source formatting, and strict OpenSpec validation
- [x] 3.3 Run an uncached live dry run, build the server package, and run the full repository test gate
