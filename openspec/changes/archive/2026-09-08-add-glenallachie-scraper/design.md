## Context

The GlenAllachie publishes its UK shop through Shopify. Its public collection JSON exposes product type, availability, GBP price, handle, tags, and official images without credentials or per-product detail requests. The same collection contains rum, gift cards, glassware, miniatures, and unavailable products alongside whisky.

The storefront currently classifies full-size whisky with four explicit product types and sells those bottles at the UK standard 700 ml size. It does not publish volume in the catalog payload or product detail markup. The catalog accepts a `country=GB` query parameter that makes GBP localization deterministic.

## Goals / Non-Goals

**Goals:**

- Collect first-party prices for available full-size whisky sold through the official GlenAllachie shop.
- Preserve the shop's published brand identity across The GlenAllachie, Meikle Tòir, White Heather, and MacNair's ranges.
- Use explicit product type and variant availability boundaries to exclude non-whisky and unavailable products.
- Keep malformed individual products from aborting useful results while preserving the shared empty-run failure.

**Non-Goals:**

- Scrape rum, gift cards, glassware, miniatures, sold-out products, or unsupported bottle sizes.
- Infer arbitrary future product categories as whisky.
- Create bottles or persist prices during local verification.

## Decisions

### Parse the public Shopify collection JSON

The worker will request the official all-products JSON endpoint with `country=GB`, `limit=250`, and an incrementing page number. The structured response exposes every required field except volume, avoids fragile HTML selectors, and removes the need for product-detail requests. An empty product page ends pagination.

### Gate eligibility with source-owned product types and availability

Only products classified as `Single Malt Scotch Whisky`, `Peated Single Malt Whisky`, `Blended Malt Whisky`, or `Blended Scotch Whisky` are eligible. A qualifying product must have exactly one available variant with a positive price. Exact matching is intentional here because Shopify product type is the storefront's explicit taxonomy rather than presentation text.

### Treat eligible non-miniature whisky as 700 ml

The source does not publish bottle volume in machine-readable data or rendered detail pages. Its qualifying full-size whisky range uses the UK standard 700 ml format, while miniatures identify themselves in the title. The scraper will exclude miniature titles, reject a conflicting explicit volume if one appears in future source text, and otherwise assign 700 ml at this source boundary.

### Preserve published brand identity

Published names already identifying The GlenAllachie, Meikle Tòir, White Heather, or MacNair's will pass through shared bottle normalization. The storefront abbreviates one Meikle Tòir exclusive while tagging it `meikle toir`; that tag will supply the missing prefix. A qualifying unbranded product without a recognized identity tag will be warned about and skipped instead of being assigned the wrong producer.

### Isolate malformed products and keep source failures visible

Invalid products, prices, URLs, images, categories, or ambiguous variants will be logged and skipped. Unexpected request or top-level payload failures will escape to the worker boundary. If no valid products remain across the complete run, the shared scraper boundary will fail explicitly.

## Risks / Trade-offs

- **The shop introduces a non-700 ml full-size whisky without publishing volume** → Reject conflicting explicit volume text when available and keep the 700 ml invariant local, documented, and covered so a source-contract update is narrow.
- **The shop renames its product types** → Unknown types are skipped, and complete coverage loss triggers the shared empty-run failure rather than a false successful run.
- **A branded title omits its identity without a recognized tag** → Warn and skip it rather than creating an ambiguous catalog identity.
- **Shopify changes its JSON schema** → Validate the response and each product at the boundary; top-level failure aborts the run while isolated invalid products do not.

## Migration Plan

Register the source and deploy the worker code, then configure GlenAllachie through the existing administrative path. No database migration is needed because external-site types are stored as text and validated by the application. Rollback consists of disabling the external site and worker job.

## Open Questions

None.
