## Why

Peated does not currently collect first-party pricing from The GlenAllachie, despite its official shop carrying active ranges from The GlenAllachie, Meikle Tòir, White Heather, and MacNair's. Adding the source expands direct producer coverage without relying on a third-party retailer.

## What Changes

- Register GlenAllachie as an external price source and worker job.
- Scrape the official public Shopify catalog for available full-size whisky bottles.
- Normalize published identities, 700 ml volume, GBP prices, official product URLs, and images.
- Exclude sold-out products, miniatures, rum, merchandise, gift cards, and malformed products.
- Add fixture-based coverage and local live verification.

## Capabilities

### New Capabilities

- `glenallachie-price-scraping`: Collect valid current whisky prices from the official GlenAllachie catalog while rejecting unavailable or unsupported products.

### Modified Capabilities

None.

## Impact

- Adds a server worker scraper, routing, fixtures, and tests.
- Reads the public GlenAllachie Shopify catalog; no new runtime dependency, protected credential, or database migration is required.
