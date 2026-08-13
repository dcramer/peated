## Why

Peated's recent scraper additions cover focused producers and one large US retailer, but broad current UK retail coverage remains thin. The Whisky World publishes an official 70 cl catalog of roughly 2,700 directly buyable whiskies with current GBP prices, canonical product URLs, and official images.

## What Changes

- Register The Whisky World as an external price source and scheduled worker job.
- Scrape its source-owned 70 cl whisky facet page by page for directly buyable single-bottle products.
- Normalize current GBP prices, canonical product URLs, titles, and official images into 700 ml listings.
- Exclude personalized products, gift sets, tasting packs, bundles, numeric multipacks, and malformed records.
- Add fixture-backed coverage and an uncached local live dry run.

## Capabilities

### New Capabilities

- `whisky-world-price-scraping`: Collect valid current GBP whisky prices from The Whisky World's broad official 70 cl catalog while rejecting non-buyable, multiproduct, or malformed offers.

### Modified Capabilities

None.

## Impact

- Adds a server worker scraper, routing, fixtures, and tests.
- Reads The Whisky World's public catalog pages; no protected credential, runtime dependency, or database migration is required.
