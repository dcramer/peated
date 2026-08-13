## Context

Mission Wine & Spirits publishes its whiskey collection through a public Shopify JSON endpoint. A full uncached audit returned 2,538 products across 11 populated pages, of which 2,458 were available. Every product had one variant, all used the exact `WHISKEY` product type, and all but one available product had one source-owned `size-*` tag. Prices are USD and product images use Shopify's HTTPS CDN.

The catalog mixes standard bottles with miniatures, gift sets, tasting packs, promotional entries, and a few inconsistent title/tag sizes. Peated only accepts known bottle volumes and must not guess when source metadata disagrees.

## Goals / Non-Goals

**Goals:**

- Collect broad current USD whiskey prices from Mission Liquor's public catalog.
- Use structured availability, product type, variants, and size tags as the primary eligibility boundary.
- Reject multiproduct offers and inconsistent records conservatively.
- Keep malformed individual records from aborting valid results while retaining the shared empty-run failure.

**Non-Goals:**

- Scrape sold-out products, miniatures, gift sets, tasting packs, bundles, or unsupported bottle sizes.
- Infer a product's size from its price or choose among multiple available variants.
- Model store location, shipping eligibility, inventory quantity, or sale history.
- Create bottles or persist prices during local verification.

## Decisions

### Parse the public whiskey collection page by page

The worker will request numbered pages from the official collection JSON endpoint with `limit=250`. Each response supplies the product metadata, variants, prices, handles, and images needed for evaluation. An empty product page ends pagination.

This avoids page scraping and product-detail requests while keeping the source contract narrow and inspectable.

### Require exact whiskey taxonomy and one available variant

Products must use the exact trimmed `WHISKEY` product type and have exactly one available variant. The live catalog currently has one variant per product, so any future multi-variant product is ambiguous and will be skipped rather than assigned an arbitrary price.

### Parse source size tags by syntax

The scraper will require exactly one tag matching the source's `size-<amount><unit>` syntax, with an optional alphabetic source suffix such as `-ND`. It will convert `ml`, `cl`, and `l` to milliliters and accept only Peated's application-level allowed volumes. Pack-like tags such as `size-3pk`, `size-750MLx2`, and `size-2PK-DEPOSIT` do not match and remain excluded.

Parsing the documented syntax is less fragile than an exact map of currently observed tags while still rejecting unknown shapes. When a title contains an explicit volume, it must agree with the tag. A matching terminal title volume is removed before shared bottle-name normalization.

### Exclude multiproduct and promotional offers conservatively

Titles identifying a gift set, tasting set, sampler, bundle, or numeric multipack are excluded. Generic words that are also legitimate release names, such as `case`, are not used as exclusions. Promotional placeholder titles beginning with `BUY` are also excluded.

### Validate official identity and isolate malformed records

Product URLs are constructed from strict Shopify handles on Mission Liquor's official origin. Images must use HTTPS on the official origin or Shopify CDN. Prices must be positive decimal USD amounts.

Invalid individual products are warned about and skipped. Request failures and invalid top-level payloads escape to the worker boundary, and a complete run with no valid listings fails through the shared scraper guard.

## Risks / Trade-offs

- **The source changes its collection taxonomy** → Unknown products remain excluded, and total taxonomy loss triggers the shared empty-run failure.
- **The source changes its size-tag grammar** → The affected products are warned about and skipped until the syntax is deliberately updated.
- **A legitimate release name resembles a multipack** → Exclusions use narrow phrases and numeric pack syntax, with fixture coverage for known false-positive words.
- **Title and tag sizes disagree** → Skip the product rather than publish a potentially incorrect bottle volume.
- **The catalog becomes location-dependent** → Re-audit the public feed before adding location behavior; this change does not infer a customer location.

## Migration Plan

Deploy the registered worker, then configure Mission Liquor through the existing administrative path. External-site types are stored as text and validated by the application, so no database migration is required. Rollback consists of disabling the source and worker job.

## Open Questions

None.
