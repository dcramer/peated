## Context

Edradour publishes its current UK shop through a server-rendered Shopware storefront. The shop listing exposes product names, official detail URLs, images, GBP prices, and an add-to-cart form only for purchasable products. Whisky detail pages expose labeled size and alcohol-by-volume properties. The same listing also contains sold-out bottles, merchandise, books, glassware, and cream liqueur, so listing membership alone is not sufficient for Peated's whisky catalog.

The catalog currently fits on one page, while `?p=2` returns no product cards. The scraper framework expects page-by-page callbacks and stops when a page emits no products. The implementation must also preserve the existing external-site enum migration workflow.

## Goals / Non-Goals

**Goals:**

- Collect first-party prices for current, purchasable Edradour and Ballechin whisky bottles.
- Use the storefront's add-to-cart state, labeled detail properties, and official URLs instead of inferring eligibility from catalog position.
- Parse supported volumes and positive GBP prices from source text.
- Keep malformed or unsupported individual products from aborting an otherwise useful run while preserving the shared empty-run failure.

**Non-Goals:**

- Scrape sold-out bottles, merchandise, books, glassware, liqueur, or unsupported bottle sizes.
- Infer availability when the source does not expose an add-to-cart form.
- Create bottles or otherwise persist data during local verification.

## Decisions

### Parse the public server-rendered storefront

The worker will request the numbered shop listing and follow official product detail URLs for cards that expose the add-to-cart form. Detail pages are necessary because bottle size and ABV are not present on listing cards. The Shopware Store API was rejected because the public storefront does not expose an unauthenticated access key, while the rendered pages already contain the authoritative public fields.

### Use detail properties to identify supported whisky

An eligible detail page must expose a supported single-bottle size and an ABV of at least 40 percent. Merchandise lacks these properties, and the shop's cream liqueur is below the whisky threshold, so the source's own labeled properties provide a narrower and more durable boundary than a hardcoded product-name allowlist.

### Preserve Edradour and Ballechin identity

Names already beginning with `Edradour` or `Ballechin` will be normalized as published. Other eligible whisky names will receive an `Edradour` prefix before shared bottle normalization because the official shop uses abbreviated names such as `Cask Strength 21 Year Old Oloroso Sherry`.

### Isolate malformed products and keep source failures visible

Invalid cards, details, prices, URLs, images, sizes, or ABVs will be logged and skipped. Unexpected fetch failures will continue to escape to the worker boundary. If no valid products remain across the complete paginated run, the shared scraper boundary will fail explicitly.

## Risks / Trade-offs

- **The Shopware theme changes its selectors** → Parse a small set of semantic storefront classes, validate every extracted boundary, and retain the empty-run failure so complete coverage loss is visible.
- **Detail requests increase source traffic** → Follow only purchasable listing cards, request each detail sequentially, and retain the shared HTTP cache outside uncached verification.
- **A future non-whisky spirit is bottled at 40 percent or above** → Require both a supported bottle size and labeled ABV, while keeping source-specific exclusion tests easy to extend if the shop adds another spirit category.
- **A valid whisky uses an unusual volume** → Warn and skip volumes outside Peated's existing allowed-volume contract rather than inventing a new catalog size.

## Migration Plan

Generate the next Drizzle migration from the updated external-site enum, deploy it before enabling the worker job, and then configure the Edradour external site through the existing administrative path. Rollback consists of disabling the external site/job; PostgreSQL enum removal is not required for an operational rollback.

## Open Questions

None.
