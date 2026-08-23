## 1. Schema And Classifier Contract

- [x] 1.1 Add classifier/server schema fields for alias scope with conservative defaults for legacy rows.
- [x] 1.2 Update classifier instructions to require alias-scope decisions without adding deterministic whisky-family shortcuts.
- [x] 1.3 Update review policy to preserve agent-declared alias scope.
- [x] 1.4 Extend eval fixture schemas and assertions to encode `aliasScope` expectations.

## 2. Evals First

- [ ] 2.1 Extend eval expectations so fixtures can assert that a listing label is not eligible for global alias storage.
- [ ] 2.2 Add a generic-label classifier eval that fails unless the classifier marks the label as no-global-alias.
- [ ] 2.3 Add a negative production-miss eval for the George Dickel-style generic title that must not auto-create a broad parent from family/sibling evidence alone.
- [ ] 2.4 Add a positive source-specific existing-match eval using a different verified case where source evidence pins a generic listing title to an existing Peated bottle/release and marks it no-global-alias.
- [ ] 2.5 Add or update replay recordings for any classifier evals that use live web evidence.
- [ ] 2.6 Run classifier evals and schema tests for the changed fixtures.

## 3. Scraper Source Identity

- [ ] 3.1 Extend `StorePriceInputSchema` and persisted store-price metadata to accept source product id, source variant id, SKU/grouping id, and source fingerprint.
- [ ] 3.2 Update `scrapePrices` in-run dedupe to prefer stable source ids over `name + volume`.
- [ ] 3.3 Update price batch ingestion to upsert by `(externalSiteId, sourceKeyType, sourceKeyValue)` when present and use title-volume only as a legacy fallback.
- [ ] 3.4 Extract source ids in scrapers that expose them: Total Wine `skuId`/URL product id, Astor item id, ReserveBar grouping id, Wooden Cork Shopify product/variant/SKU, and Healthy Spirits Lightspeed `data-pid`/variant id.
- [ ] 3.5 Add scraper and ingestion tests for same-title/different-source-id preservation.

## 4. Source-Scoped Persistence

- [x] 4.1 Keep the MVP on existing tables: the exact `store_price.bottleId` is durable identity, while observations and decision logs preserve evidence. Defer reuse by a future source row.
- [ ] 4.2 Implement the selected persistence model with source keys for external site, internal store listing id when available, product id or canonical URL, optional SKU/fingerprint, target bottle/release, scope, evidence hash, confidence, and actor.
- [ ] 4.3 Add migration and database tests for source-scoped lookup and non-reuse by display title alone.

## 5. Approval And Alias Safety

- [x] 5.1 Update store-price approval flow to skip BottleAlias assignment when alias scope is `none` or missing.
- [x] 5.2 Preserve exact source evidence and source-scope metadata in observations and decision logs.
- [x] 5.3 Add integration tests proving source-only approval assigns the exact StorePrice, creates no BottleAlias, and does not update unrelated same-name listings or reviews.
- [x] 5.4 Keep missing alias-safety metadata conservative.
- [x] 5.5 Keep current BottleAlias behavior for explicit reusable approvals when the moderator accepts the suggested Bottle.
- [x] 5.6 Add a moderator API for preview-first repair of proven ignored BottleAlias rows from old source-only approvals. Require explicit names for execution and leave active rows for manual review.
- [x] 5.7 Add stable cursor pagination so report-only BottleAlias rows cannot hide later repair candidates.

## 6. Scraper Reuse

- [ ] 6.1 Update store-price ingestion or resolution to consult source-scoped verification by stable source identity before generic classifier matching.
- [ ] 6.2 Require review/classifier fallback when stable source identity is missing, changed, or expired.
- [ ] 6.3 Add tests for same-site/source-key reuse, same-title/different-source non-reuse, same-title/different-store non-reuse, and same source-key value on different stores not reusing verification.

## 7. Automation Gates

- [ ] 7.1 Allow high-confidence source-scoped existing matches or unassigned corrections to auto-verify only when exact source evidence, known candidates, and deterministic blockers align.
- [ ] 7.2 Keep create-new automation blocked for generic or underspecified listing identity.
- [ ] 7.3 Add targeted automation tests for source-scoped assignment, generic-create blocking, and legacy-scope defaults.

## 8. Documentation And Validation

- [x] 8.1 Update `docs/features/store-price-matching.md` with source-scoped listing identity and BottleAlias safety behavior.
- [ ] 8.2 Update `docs/architecture/bottle-classifier.md` with the classifier alias-safety contract.
- [x] 8.3 Run the full server test suite, repo typecheck, and repo lint for the touched approval, BottleAlias, CLI, and documentation surfaces. Classifier eval behavior did not change.
- [ ] 8.4 Capture any remaining open questions before enabling broad automation.
