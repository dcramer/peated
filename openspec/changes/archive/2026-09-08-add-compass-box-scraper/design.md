## Context

Compass Box publishes both a comprehensive whisky archive and a narrower UK/rest-of-world shop. The global Shopify product feed contains archive presentation records alongside shoppable records, often duplicating a release under multiple handles. The server-rendered `/collections` shop page is the authoritative purchasable subset and gives each product card a canonical URL, displayed GBP price, availability badge, and official image.

The shop assortment uses standard 70 cl bottles. Product cards do not repeat that volume, while the official product pages and linked retail listings identify the format.

## Goals / Non-Goals

**Goals:**

- Register Compass Box as a scheduled external price source.
- Parse the official UK/rest-of-world shop into schema-valid GBP store-price inputs.
- Exclude sold-out products and keep provider-contract failures visible.
- Cover the provider contract with deterministic fixtures and verify it against the live shop.

**Non-Goals:**

- Import the complete Compass Box historical archive or archive-only zero-price records.
- Scrape the United States, France, or Germany regional shops.
- Infer bottle identity beyond the existing store-price matching pipeline.

## Decisions

### Parse the rendered shop rather than the global product feed

The scraper will use the existing HTTP client and Cheerio to parse product cards on `/collections`. The global Shopify feed was rejected because it mixes catalog and commerce records and duplicates many releases. The shop page is already curated to the region and makes sold-out status explicit.

### Apply the shop's 700 ml bottle contract

Every supported shop product will be emitted as a 700 ml bottle. The official range uses 70 cl bottles, but the card markup does not repeat the size. This default is deliberately scoped to the whisky-only shop page and will be revisited if Compass Box lists a different format there.

### Preserve the displayed GBP selling price

The parser will convert the page's displayed regular or sale price to integer pence. It will prefer an active sale price when the card identifies one, otherwise using the regular price, and will not estimate taxes or convert currencies.

### Treat malformed candidates and empty output as failures

Every non-sold-out product card must contain a non-empty name, valid canonical product URL, positive parsable price, and valid official image URL. An incomplete candidate will raise at the parser boundary. The existing `scrapePrices` guard will fail a complete run that emits no listings.

## Risks / Trade-offs

- [Compass Box changes its theme markup] -> Keep selectors local, require owned fields, and fail an empty run so breakage is observable.
- [A different bottle format enters the shop] -> Keep the 700 ml default scoped to this source and revise the contract when the provider exposes another format.
- [Regional pricing differs] -> Target the named UK/rest-of-world storefront and preserve its displayed GBP amount.
- [The archive offers broader identity coverage] -> Keep this change within price ingestion; a future archive importer can use the classification/review path without weakening price correctness.

## Migration Plan

Add `compassbox` to the external-site enum and generate the corresponding PostgreSQL enum migration with the repository command. Deploy the migration before scheduling the new source. Rollback consists of disabling or removing configured Compass Box sources before reverting the application change; the additive enum value itself is harmless if left in place.

## Open Questions

None.
