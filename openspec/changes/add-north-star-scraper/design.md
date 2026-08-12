## Context

Peated's retailer-style scrapers emit `StorePriceInputSchema` records through the shared `scrapePrices` batching helper. This lets existing ingestion, matching, observations, moderation, and classifier automation own bottle identity. SMWS is a special trusted structured source that can create bottles directly; North Star does not need or justify that privilege.

North Star's Shopify storefront exposes live products at a collection-scoped JSON endpoint. The same store also retains archived products, but those records are unavailable and usually priced at zero. The first vertical slice should cover live prices only and must not turn archived catalog records into direct canonical mutations.

## Goals / Non-Goals

**Goals:**

- Add a scheduled North Star external site using existing worker and store-price boundaries.
- Validate the provider response at ingress.
- Persist current purchasable whisky prices with stable product URLs and images.
- Exclude unavailable and clearly non-whisky storefront products deterministically.
- Prove parsing behavior with a small provider-shaped fixture and targeted tests.

**Non-Goals:**

- Do not import North Star's historical archive as canonical bottles.
- Do not add or generalize stable Shopify product-id persistence; the active `add-source-scoped-store-price-identity` change owns that contract.
- Do not change store-price matching, alias, or automation policy.
- Do not create a reusable Shopify scraper abstraction before a second source proves shared behavior.

## Decisions

### Use the live shop collection feed

Fetch `https://northstarspirits.com/collections/shop/products.json?limit=250&page=<page>` through the existing cached HTTP boundary. Pagination continues through `scrapePrices` until a page emits no supported products.

This is preferred over the global product feed because the global feed intentionally contains the historical archive. It is preferred over scraping rendered HTML because the collection JSON provides typed product, variant, availability, price, handle, and image fields.

### Route records through store-price matching

Emit `StorePriceInputSchema` records and let `createStorePricesAsPeated` enqueue ordinary matching. Do not call `handleBottle`, because North Star's catalog has not been granted the deterministic trusted-source semantics held by SMWS.

### Keep parsing local and provider-shaped

Own a small Zod schema in the North Star job for the Shopify fields the scraper consumes. Convert the first available, positively priced variant into one product listing, construct the canonical `/products/<handle>` URL, use the primary image when present, and parse an explicit supported volume from the title or description before falling back to 700 ml.

This keeps provider details inside the job and avoids a generic Shopify abstraction until another implementation demonstrates identical needs.

### Exclude only concrete unsupported products

Skip unavailable and zero-price records using structured variant fields. Skip products whose title explicitly identifies a non-whisky base spirit, with focused coverage for the gin item currently mixed into the shop collection. Do not infer whisky category, distillery, or canonical identity in the scraper.

## Risks / Trade-offs

- North Star can reorganize collection handles or Shopify fields -> validate the response and fail loudly when a run yields no supported listings.
- A future product may use multiple purchasable variants -> this slice chooses the first available positive-price variant because current products represent one bottle per product page; revisit when a real multi-variant bottle appears.
- The 700 ml fallback may be wrong for a future unstated miniature or large format -> explicit supported volume wins, and fixture coverage protects parsing; ambiguous current UK bottlings use the established 700 ml storefront default.
- Title-based non-whisky exclusion is intentionally narrow -> ordinary matcher safeguards still prevent a missed non-whisky listing from becoming a bottle, while the scraper avoids speculative spirit classification.

## Migration Plan

1. Register the new enum value and generate the database migration.
2. Deploy the worker implementation and tests.
3. Create/configure the `northstarspirits` external-site row through the existing admin/API workflow.
4. Trigger a manual run and inspect emitted listings before enabling a recurring interval.

Rollback removes or disables the external-site schedule. Existing store-price rows remain ordinary source observations and require no special cleanup.

## Open Questions

- Historical archive ingestion should be designed separately after the live source proves stable.
