## Context

Peated's retailer-style scrapers emit `StorePriceInputSchema` records through the shared `scrapePrices` batching helper. Existing ingestion and matching own bottle identity, so Gordon & MacPhail does not need direct canonical bottle creation.

The official Gordon & MacPhail retail shop runs Shopify. Its public product catalog exposes paginated records with product handles, descriptions, images, variant availability, and decimal GBP prices. The current catalog is intentionally small and includes an unavailable product, while one available product states its 70 cl size only in the primary image filename.

## Goals / Non-Goals

**Goals:**

- Add a scheduled Gordon & MacPhail external site through the existing worker and store-price boundaries.
- Validate every provider field the scraper consumes while allowing irrelevant Shopify extensions.
- Emit available, positively priced bottle listings with stable URLs, primary images, and explicit supported volumes.
- Exclude unavailable, zero-price, explicitly non-whisky, and ambiguous-size records deterministically.
- Prove the provider contract with a compact fixture and targeted tests.

**Non-Goals:**

- Do not create or update canonical bottles directly from Gordon & MacPhail records.
- Do not scrape the rendered storefront or ingest events, merchandise, or non-whisky spirits.
- Do not persist Shopify product or variant ids; the active source-scoped store-price identity change owns that contract.
- Do not introduce a generic Shopify adapter before the existing source implementations demonstrate a stable shared contract.

## Decisions

### Use Shopify's public product catalog

Fetch `https://shop.gordonandmacphail.com/products.json?limit=250&page=<page>` through the existing cached HTTP boundary. Pagination continues through `scrapePrices` until a page emits no supported products.

The JSON catalog is preferred over rendered collection HTML because it exposes structured availability, prices, product handles, descriptions, and image URLs without browser execution. A 250-product page also keeps request volume low for the currently small catalog.

### Route records through store-price matching

Emit `StorePriceInputSchema` records and let the existing store-price path own matching and persistence. Product URLs are derived from the validated handle on the official shop origin.

### Keep Shopify parsing local and provider-shaped

Own a small Zod schema in the Gordon & MacPhail job for the product and variant fields the parser consumes. Allow additional Shopify fields because they are provider-owned and irrelevant to Peated.

Select the first available variant with a positive, precisely parseable decimal GBP price. Normalize the product title structurally, attach the first image when present, and exclude a product only when its title or description explicitly identifies a non-whisky category such as gin, rum, wine, or merchandise.

### Require explicit volume evidence

Search the title, description, and product image URLs for an explicit `ml`, `cl`, or `l` token and convert it to milliliters. Emit only values accepted by Peated's store-price schema. Image URLs are included because the live Linkwood listing explicitly identifies `70cl` in its official primary media filename while omitting volume from the visible title and description. Never assume a default bottle volume.

## Risks / Trade-offs

- Gordon & MacPhail can disable or replace the public Shopify catalog -> validate the payload and fail loudly when a complete run yields no supported listings.
- Product media filenames are less stable than structured metafields -> accept them only as explicit size evidence and skip the listing if that evidence disappears.
- A future catalog page could contain only filtered products before a later page -> the shared scraper stops when a page emits nothing; the 250-product page size makes that unlikely and matches existing Shopify jobs.
- A real bottle may omit volume everywhere -> skip and warn rather than guess.
- A non-whisky product may use an unfamiliar category word -> matching remains reviewable through the ordinary store-price pipeline, while known non-whisky categories are excluded at ingress.

## Migration Plan

1. Register `gordonmacphail` in the external-site enum and generate the next database migration from current `main`.
2. Deploy the worker, parser, and deterministic coverage.
3. Configure the external-site row through the existing administration workflow.
4. Run a live dry run and inspect the supported listing count before enabling a recurring schedule.

Rollback disables the source schedule. Existing store-price rows remain ordinary source observations and need no source-specific cleanup.

## Open Questions

- None for the current official catalog contract.
