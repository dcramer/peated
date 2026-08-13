## 1. Source Registration

- [x] 1.1 Register `berrybrosrudd` in the external-site type list and worker routing
- [x] 1.2 Generate the PostgreSQL external-site enum migration

## 2. Scraper Implementation

- [x] 2.1 Implement filtered catalog pagination and desktop-card parsing
- [x] 2.2 Parse and normalize eligible GBP listings, supported volumes, URLs, and images
- [x] 2.3 Warn and skip malformed, unavailable, or unsupported cards while retaining empty-run failure

## 3. Verification

- [x] 3.1 Add representative HTML fixtures and focused parser, pagination, routing, and failure tests
- [x] 3.2 Run targeted tests, typecheck, lint, formatting, and strict OpenSpec validation
- [x] 3.3 Run an uncached live dry run and build the server package
