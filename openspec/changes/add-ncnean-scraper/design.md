## Context

Nc'nean's official UK shop is backed by Shopify. Its public all-products catalog exposes tags, availability, GBP prices, descriptions, handles, vendor identity, and official images without credentials or product-detail requests. The same catalog contains merchandise, gift sets, botanical spirit, and miniatures alongside full-size whisky.

Whisky products use the exact `Whiskies` tag, miniatures also use `Miniatures`, and full-size descriptions publish a 70 cl specification. Titles commonly omit the distillery name, while the exact vendor identifies Nc'nean. The flagship bottle currently has separate with-tube and without-tube packaging variants.

## Goals / Non-Goals

**Goals:**

- Collect first-party prices for available 70 cl whisky sold through the official Great Britain shop.
- Preserve release names while supplying source-owned Nc'nean identity.
- Use exact tags, description volume, availability, and packaging metadata rather than broad name guessing.
- Keep malformed individual records from aborting valid results while retaining the shared empty-run failure.

**Non-Goals:**

- Scrape miniatures, gift sets, botanical spirit, merchandise, unavailable products, or unsupported bottle sizes.
- Infer bottle size from price, title conventions, or product handles.
- Create bottles or persist prices during local verification.

## Decisions

### Parse the Great Britain-localized Shopify catalog

The worker will request numbered pages from the official all-products JSON endpoint with `country=GB` and `limit=250`. This makes GBP localization explicit and supplies all required fields in one structured response. An empty product page ends pagination.

### Gate eligibility with exact source metadata

Products require the exact `Whiskies` tag and must not carry `Miniatures`. Their descriptions must contain exactly one parseable bottle-volume token and it must resolve to 700 ml. This is preferred over product type because the live catalog's product type field is largely empty and contains at least one known merchandise misclassification.

### Select an unambiguous purchasable variant

A product with one available variant uses that price. A product with multiple available variants is accepted only when exactly one variant begins with `Without gift tube`; this selects the bottle-only flagship price without treating optional packaging as a separate bottle. Other multi-variant products are warned about and skipped.

### Preserve source-owned Nc'nean identity

Eligible products must use the exact trimmed `Nc'nean Distillery` vendor. Titles already beginning with Nc'nean pass through shared normalization; other eligible titles receive the Nc'nean prefix. This keeps identity source-owned without trusting incidental title text.

The source publishes catalog titles in all caps. Those titles are converted to readable title case before shared normalization while punctuation and numeric cask identifiers are preserved.

### Validate official URLs and isolate malformed records

Product URLs are constructed from strict Shopify handles on the official origin. Images must use HTTPS on the official shop or Shopify CDN. Invalid individual products are warned about and skipped; request failures and invalid top-level payloads escape to the worker boundary. A complete run with no valid listings fails through the shared scraper guard.

## Risks / Trade-offs

- **The shop renames its whisky tag** → Unknown taxonomy remains excluded, and total taxonomy loss triggers the shared empty-run failure.
- **Descriptions publish multiple volume-like tokens** → Warn and skip rather than guess which token describes the bottle.
- **The flagship packaging labels change** → Skip the ambiguous product until the verified label is updated with fixture coverage.
- **Regional behavior changes** → Keep `country=GB` explicit and verify it in every uncached live dry run.

## Migration Plan

Deploy the registered worker, then configure Nc'nean through the existing administrative path. External-site types are stored as text and validated by the application, so no database migration is required. Rollback consists of disabling the source and worker job.

## Open Questions

None.
