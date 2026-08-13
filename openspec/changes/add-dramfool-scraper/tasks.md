## 1. Source Registration

- [x] 1.1 Register `dramfool` in the external-site type list and worker routing
- [x] 1.2 Generate the PostgreSQL external-site enum migration

## 2. Scraper Implementation

- [x] 2.1 Implement structured catalog validation and single-response processing
- [x] 2.2 Parse and normalize eligible in-stock GBP variants, supported volumes, URLs, and images
- [x] 2.3 Warn and skip malformed, unavailable, or unsupported variants while retaining empty-run failure

## 3. Verification

- [x] 3.1 Add representative JSON fixtures and focused parser, routing, pagination, sale-price, and failure tests
- [x] 3.2 Run targeted tests, typecheck, lint, formatting, and strict OpenSpec validation
- [x] 3.3 Run an uncached live dry run, build the server package, and run the full repository test gate
