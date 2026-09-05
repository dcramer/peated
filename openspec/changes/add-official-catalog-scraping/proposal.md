## Why

Peated can collect reviews and store prices from saved sources, but it cannot save products from an official catalog when the pages have neither. These pages can provide accurate bottle names and details, but they should not change Peated's Bottle records without review.

## What Changes

- Add an `Official product catalog` source kind with versioned rules for product lists and pages.
- Save each product under its source, using its product ID or page URL, and record when Peated last saw it.
- Let administrators preview rules and browse saved products.
- Keep collection separate from Bottle matching and editing. Catalog runs do not create or update Bottles, reviews, prices, references, or Bottle observations.
- Preserve existing configured review and price source behavior and stored parsing-rule revisions.

## Capabilities

### New Capabilities

- `official-catalog-scraping`: Configure, preview, collect, and inspect products from an official catalog without requiring a review or price and without changing Bottle data.

### Modified Capabilities

None.

## Impact

- Scraper rule schemas, setup guidance, parsing, previews, and collection.
- Scrape-source kind storage and generated database migration.
- A new catalog-listing schema, repeat-safe save service, and administrator-only API.
- Administrator source creation, parsing preview, product-detail counts, and a list of collected products.
- Focused server and web tests; no public API or Bottle behavior changes.
