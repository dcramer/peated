## Context

Thompson Bros publishes its current shop through WooCommerce. The public Store API exposes product name, permalink, integer minor-unit price, currency metadata, images, stock, and purchasability. Its category `18` combines whisky and rum, so category filtering alone is not sufficient for Peated's whisky catalog.

The source currently returns fewer than 100 matching products, but the scraper framework expects page-by-page callbacks and stops on the first empty page. The implementation must also preserve the existing external-site enum migration workflow.

## Goals / Non-Goals

**Goals:**

- Collect first-party prices for current, purchasable Thompson Bros whisky bottles.
- Use structured source fields for stock, price, URL, and image data.
- Parse bottle volumes flexibly from product names using `ml`, `cl`, or `l` notation.
- Keep malformed or unsupported individual products from aborting an otherwise useful run while preserving the shared empty-run failure.

**Non-Goals:**

- Scrape rum, gin, events, shipping products, samples, or sold-out archive entries.
- Infer prices for regions other than the GBP price published by the Store API.
- Create bottles or otherwise persist data during local verification.

## Decisions

### Consume the public WooCommerce Store API

The worker will request category `18` with `stock_status=instock`, `per_page=100`, and the scraper framework's page number. Structured JSON is less coupled to theme markup and the shop's age gate than HTML product-card selectors. Scraping rendered HTML was rejected because it duplicates data already available through the shop's public catalog contract.

### Validate the response boundary and isolate malformed products

The top-level response must be an array. Each product will then be validated independently with Zod. Invalid records, URLs, images, currencies, prices, or volumes will be logged and skipped; if no valid products remain across the complete run, the shared scraper boundary will fail explicitly.

### Select whisky from the combined category

The source's category includes both whisky and rum. Products whose decoded names identify rum will be skipped before bottle normalization. Eligibility will also require source-provided in-stock and purchasable flags, a positive GBP price with two minor units, and a supported single-bottle volume.

### Preserve bottler identity in normalized names

Decoded product names that do not already mention Thompson Bros will receive a `Thompson Bros` prefix before the shared bottle normalizer runs. This distinguishes the independent bottling from distillery-owned releases with similar names.

## Risks / Trade-offs

- **The source changes the category ID or Store API schema** → Strict boundary validation and the empty-run failure make a complete coverage loss visible; fixture tests cover the fields Peated owns.
- **A rum product omits the word `rum`** → The combined upstream category does not provide a finer taxonomy. The parser also requires a supported bottle volume, and tests pin explicit rum exclusion, but an ambiguously named future spirit could require a source-specific exclusion update.
- **WooCommerce prices vary with tax/location configuration** → Store the exact positive GBP minor-unit price returned by the same public catalog endpoint used for the run rather than guessing a tax adjustment.
- **The catalog grows beyond one page** → Keep framework pagination and stop only when the API returns an empty page.

## Migration Plan

Generate the next Drizzle migration from the updated external-site enum, deploy it before enabling the worker job, and then configure the Thompson Bros external site through the existing administrative path. Rollback consists of disabling the external site/job; PostgreSQL enum removal is not required for an operational rollback.

## Open Questions

None.
