## Context

Bruichladdich's official UK shop is backed by Shopify. Its public all-products catalog exposes product type, variant availability, GBP price, an explicit 70 cl variant title, handle, tags, and official images without credentials or product-detail requests. The same catalog also contains clothing, accessories, and glassware, while unavailable historical whisky records remain present beside purchasable releases.

The active whisky catalog spans Bruichladdich, Port Charlotte, and Octomore. Most titles publish the brand directly; project releases can omit it while retaining a source-owned vendor identity.

## Goals / Non-Goals

**Goals:**

- Collect first-party prices for available full-size whisky sold through the official Great Britain shop.
- Preserve published Bruichladdich, Port Charlotte, and Octomore identity.
- Use source-owned product types, variants, and vendor identity rather than broad name guessing.
- Keep malformed individual records from aborting valid results while retaining the shared empty-run failure.

**Non-Goals:**

- Scrape gin, merchandise, glassware, unavailable products, zero-price placeholders, or unsupported bottle sizes.
- Ingest the historical sold-out catalog as bottle observations.
- Create bottles or persist prices during local verification.

## Decisions

### Parse the Great Britain-localized Shopify catalog

The worker will request numbered pages from the official all-products JSON endpoint with `country=GB` and `limit=250`. This makes GBP localization explicit and supplies the required fields in one structured response. An empty product page ends pagination.

### Gate eligibility with exact source taxonomy

Only the four product types currently owned by the shop's whisky taxonomy are eligible: unpeated, general, heavily peated, and super-heavily peated Islay single malt Scotch whisky. Exact matching is intentional because these values are structured provider classifications. A qualifying product must have exactly one available variant, an explicitly supported 700 ml variant title, and a positive price.

### Preserve source-owned brand identity

Titles beginning with Bruichladdich, Port Charlotte, or Octomore pass through shared bottle normalization. Exact brand tags can supply a missing prefix, while the exact `Bruichladdich Distillery` vendor supplies Bruichladdich identity for project titles that omit a brand tag. An otherwise eligible product without recognized source identity is warned about and skipped rather than assigned to a guessed brand.

### Validate official URLs and isolate malformed records

Product URLs are constructed from strict Shopify handles on the official origin. Images must use HTTPS on the official shop or Shopify CDN. Invalid individual products are warned about and skipped; request failures and invalid top-level payloads escape to the worker boundary. A complete run with no valid listings fails through the shared scraper guard.

## Risks / Trade-offs

- **The shop renames a product type** → Unknown types remain excluded, and total taxonomy loss triggers the shared empty-run failure.
- **A new volume format appears** → Warn and skip it until the verified alias is added with fixture coverage.
- **A project release omits title, tag, and recognized vendor identity** → Skip it rather than create an ambiguous catalog identity.
- **Regional behavior changes** → Keep `country=GB` explicit and verify it in every uncached live dry run.

## Migration Plan

Deploy the registered worker, then configure Bruichladdich through the existing administrative path. External-site types are stored as text and validated by the application, so no database migration is required. Rollback consists of disabling the source and worker job.

## Open Questions

None.
