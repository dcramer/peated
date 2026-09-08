## 1. Data Model

- [x] 1.1 Add the catalog scrape-source kind and preserve exact parsing for older rule versions
- [x] 1.2 Add the catalog-listing schema, relations, product ID and URL constraints, and generated migration
- [x] 1.3 Add integration tests for product identity, repeat collection, updates, and conflicts

## 2. Scraper Rules

- [x] 2.1 Add catalog list and product-page rules using the existing page readers
- [x] 2.2 Add parser tests for required names, optional product IDs, URLs, bottle details, and excluded prose
- [x] 2.3 Extend setup discovery, model guidance, suggestions, and checks for catalog sources

## 3. Runtime Collection

- [x] 3.1 Add repeat-safe catalog-listing storage with per-source database locks
- [x] 3.2 Send collected catalog products to their storage path without creating Bottles, reviews, or prices
- [x] 3.3 Add runtime and preview tests for collection-only behavior and repeat runs

## 4. Administrator API And UI

- [x] 4.1 Add administrator-only routes for a paged product list and product-detail counts, with response tests
- [x] 4.2 Add Official product catalog to source creation and parsing-rule editing
- [x] 4.3 Show catalog previews, collected products, and product-detail counts on external-site Admin pages
- [x] 4.4 Add focused web tests for catalog source setup, preview, and collected product states

## 5. Verification

- [x] 5.1 Format and lint affected files and run focused server and web tests
- [x] 5.2 Run server and web typechecks and validate the OpenSpec change
- [x] 5.3 Manually verify an administrator can configure, preview, and inspect a no-price catalog without writing Bottle data
