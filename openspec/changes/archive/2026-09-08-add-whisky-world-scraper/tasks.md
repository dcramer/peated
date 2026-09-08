## 1. Source Registration

- [x] 1.1 Register `whiskyworld` in the external-site type list and worker routing
- [x] 1.2 Verify registered types remain accepted and unknown types remain rejected by application validation

## 2. Scraper Implementation

- [x] 2.1 Implement paginated exact-70-cl catalog fetching and card parsing
- [x] 2.2 Parse direct-buy state, GBP prices, normalized titles, official product URLs, and lazy or eager official images into 700 ml listings
- [x] 2.3 Exclude non-buyable, multiproduct, untrusted, and malformed cards while retaining complete-run failure

## 3. Verification

- [x] 3.1 Add representative fixtures and focused routing, parsing, exclusion, pagination, and failure tests
- [x] 3.2 Run targeted tests, typecheck, lint, source formatting, and strict OpenSpec validation
- [x] 3.3 Run an uncached live dry run, build the server package, and run the full repository test gate
