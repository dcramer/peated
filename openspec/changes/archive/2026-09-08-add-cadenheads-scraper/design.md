## Context

Peated's retailer-style scrapers emit `StorePriceInputSchema` records through the shared `scrapePrices` batching helper. Existing ingestion, matching, observation, moderation, and classifier automation then own bottle identity. Cadenhead's is a valuable independent-bottler source, but it does not need the direct bottle-creation privileges reserved for the trusted structured SMWS integration.

Cadenhead's online shop runs WooCommerce. Its public Store API accepts the stable `whisky` category slug and exposes paginated product records with VAT-inclusive prices in GBP minor units, stock and purchasability flags, canonical product URLs, images, and structured volume attributes. The live category currently also contains a tasting pack, so category membership alone is not sufficient evidence that a record represents a supported bottle format.

## Goals / Non-Goals

**Goals:**

- Add a scheduled Cadenhead's external site through the existing worker and store-price boundaries.
- Validate the provider response at ingress while permitting irrelevant WooCommerce extension fields.
- Persist current purchasable bottle prices with stable product URLs, primary images, and supported volumes.
- Exclude unavailable, zero-price, and unsupported bottle formats deterministically.
- Prove parsing behavior with a compact provider-shaped fixture and targeted tests.

**Non-Goals:**

- Do not create or update canonical bottles directly from Cadenhead's records.
- Do not ingest tasting packs, event tickets, glassware, or other non-bottle shop products.
- Do not add stable provider product-id persistence; the active `add-source-scoped-store-price-identity` change owns that contract.
- Do not create a generic WooCommerce scraper abstraction before another source proves identical needs.

## Decisions

### Use the public WooCommerce Store API

Fetch `https://www.cadenhead.shop/wp-json/wc/store/v1/products?category=whisky&per_page=100&stock_status=instock&page=<page>` through the existing cached HTTP boundary. Pagination continues through `scrapePrices` until a page emits no supported products.

This is preferred over rendered category HTML and its plugin-specific AJAX pagination because the Store API exposes stable structured fields and VAT-inclusive prices. The `whisky` slug is preferred over the current numeric category id so taxonomy record recreation does not change the scraper contract.

### Route records through store-price matching

Emit `StorePriceInputSchema` records and let `createStorePricesAsPeated` enqueue ordinary matching. Do not call `handleBottle`; the source provides strong listing metadata but has not been granted trusted canonical identity semantics.

### Keep WooCommerce parsing local and provider-shaped

Own a small Zod schema in the Cadenhead's job for the fields the scraper consumes. Explicitly allow additional WooCommerce fields because they are provider-owned opaque extensions and are not used for routing or persistence.

Require GBP prices with two minor-unit digits, positive integer price strings, in-stock and purchasable flags, canonical product URLs, and optional primary images. Decode HTML entities in provider names before applying Peated's structural bottle-name normalization.

### Require an explicit supported bottle volume

Prefer the `pa_volume-ml` product attribute and fall back to an explicit `ml`, `cl`, or `l` token in the product name for older records such as Campbeltown Loch. Emit only volumes allowed by `StorePriceInputSchema`; do not assume 700 ml when the shop omits size data. This excludes the current tasting pack and prevents an ambiguous non-bottle product from entering matching.

## Risks / Trade-offs

- Cadenhead's can disable or replace the Store API -> validate the response and fail loudly when a run yields no supported listings.
- A future catalog may exceed 100 products -> use page-based requests and stop only after an empty page.
- A real bottle may omit both structured and title volume -> skip it rather than guess; the warning identifies the listing for parser adjustment.
- A future variable product may expose a price range rather than one price -> this slice accepts only a positive concrete price because all current whisky listings are simple products.
- WooCommerce may add fields at any time -> allow provider-owned extras while strictly parsing every field used by Peated.

## Migration Plan

1. Register the new enum value and generate the database migration.
2. Deploy the worker implementation and deterministic coverage.
3. Create or configure the `cadenheads` external-site row through the existing admin/API workflow.
4. Trigger a dry run against the live Store API and inspect the emitted listing count before enabling a recurring interval.

Rollback removes or disables the external-site schedule. Existing store-price rows remain ordinary source observations and require no source-specific cleanup.

## Open Questions

- None for the live bottle-price slice. Historical or non-bottle product ingestion would require a separate contract.
