## 1. Schema And Classifier Contract

- [x] 1.1 Add classifier/server schema fields for alias scope with conservative defaults for legacy rows.
- [x] 1.2 Update classifier instructions to require alias-scope decisions without adding deterministic whisky-family shortcuts.
- [x] 1.3 Update review policy to preserve agent-declared alias scope.
- [x] 1.4 Extend eval fixture schemas and assertions to encode `aliasScope` expectations.

## 2. Classifier Boundary

- [x] 2.1 Extend eval expectations so fixtures can assert `aliasScope` without changing classifier actions.
- [x] 2.2 Keep classifier actions at exact Bottle match, exact Bottle create, or no safe match.

## 3. Scraper Source Identity

- [x] 3.1 Extend `StorePriceInputSchema` and StorePrice persistence with an optional source fingerprint; continue using `externalProductId` for each source's strongest product, variant, SKU, or grouping id.
- [x] 3.2 Update `scrapePrices` in-run dedupe to prefer stable source ids over URL.
- [x] 3.3 Update price batch ingestion to upsert by `(externalSiteId, externalProductId)` when present and use URL only as the fallback.
- [x] 3.4 Extract source ids in scrapers that expose them: Total Wine URL product id, Astor item id, ReserveBar grouping id, Wooden Cork Shopify product id, and Healthy Spirits product id.
- [x] 3.5 Add scraper and ingestion tests for same-title/different-source-id preservation.

## 4. Source-Scoped Persistence

- [x] 4.1 Keep the MVP on existing tables: the exact `store_price.bottleId` is durable identity, while observations and decision logs preserve evidence. Defer reuse by a future source row.
- [x] 4.2 Store a Bottle-relevant source fingerprint on StorePrice and preserve its exact Bottle assignment only while that fingerprint is unchanged.
- [x] 4.3 Add migration and database tests for same-row assignment reuse, changed-fingerprint reclassification, cross-store isolation, and non-reuse by display title.

## 5. Approval And Alias Safety

- [x] 5.1 Update store-price approval flow to skip BottleAlias assignment when alias scope is `none` or missing.
- [x] 5.2 Preserve exact source evidence and source-scope metadata in observations and decision logs.
- [x] 5.3 Add integration tests proving source-only approval assigns the exact StorePrice, creates no BottleAlias, and does not update unrelated same-name listings or reviews.
- [x] 5.4 Keep missing alias-safety metadata conservative.
- [x] 5.5 Keep current BottleAlias behavior for explicit reusable approvals when the moderator accepts the suggested Bottle.
- [x] 5.6 Add a temporary moderator API for preview-first repair of proven ignored BottleAlias rows from old source-only approvals. Require explicit names for execution and leave active rows for manual review.
- [x] 5.7 Add stable cursor pagination so report-only BottleAlias rows cannot hide later repair candidates.
- [x] 5.8 Remove the temporary repair API, helper, tests, and documentation after the exhaustive production audit reports no eligible rows.

## 6. Scraper Reuse

- [x] 6.1 Skip generic classification when the same StorePrice has an unchanged source fingerprint and an exact Bottle assignment.
- [x] 6.2 Queue normal classification when the source fingerprint changed and current deterministic evidence cannot establish an exact Bottle.
- [x] 6.3 Add tests for unchanged source reuse, changed-source fallback, same-title non-reuse, and same product-id isolation across stores.

## 8. Documentation And Validation

- [x] 8.1 Update `docs/features/store-price-matching.md` with source-scoped listing identity and BottleAlias safety behavior.
- [x] 8.2 Keep the documented classifier contract unchanged: exact Bottle match, exact Bottle create, or no safe match.
- [x] 8.3 Run the focused ingestion integration suite, server typecheck, touched-file lint, and strict OpenSpec validation. Pull request CI owns the full-repo test gate.
- [x] 8.4 Document source-key reuse, fingerprint invalidation, and the deferred time-based revalidation question.
