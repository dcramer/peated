## Context

Single Cask Nation's Shopify storefront separates its current online-exclusive shop from retail-only bottlings and its historical archive. The `frontpage` collection JSON feed contains 28 current shop records with owned product types, variants, prices, availability, handles, and images. At live inspection, 25 of the 26 purchasable records are whisky bottles and one is a gift card. The storefront sells only within the United States, displays USD, and official bottle images across its current bourbon, Scotch, and Australian releases identify the format as 700 ml or 70 cl.

## Goals / Non-Goals

**Goals:**

- Register Single Cask Nation as a scheduled external store-price source.
- Emit available, schema-valid 700 ml USD whisky listings from its official online shop.
- Preserve Single Cask Nation as the bottler in listing names.
- Keep provider-contract failures visible and cover the source with deterministic fixtures and live QA.

**Non-Goals:**

- Import retail-only bottlings, historical archive records, or unavailable shop products.
- Import gift cards or non-whisky products.
- Scrape or convert prices for non-US markets.
- Infer bottle identity beyond the existing store-price matching pipeline.

## Decisions

### Parse the official shop collection JSON feed

The scraper will paginate `/collections/frontpage/products.json?limit=250&page=N&country=US`. This is the same curated collection rendered by the shop and provides structured product type, availability, price, URL handle, and image data without theme-specific HTML parsing. The retail bottlings collection and archive were rejected because those products are explicitly unavailable for purchase through the website and do not represent first-party store prices.

### Define eligibility from exact current whisky product types

Eligible records must use one of the provider's six current whisky product types: `American Single Malt Whisky`, `Australian Rye Whisky`, `Bourbon Whisky`, `Single Grain Scotch Whisky`, `Single Malt Scotch Whisky`, or `Straight Rye Whisky`. The `Gift Card` product type is excluded. Exact provider-owned types avoid broad name heuristics while making taxonomy drift observable through empty-run protection.

### Apply the shop's 700 ml online-exclusive contract

Every supported shop product will be emitted as 700 ml. The collection payload does not expose liquid volume, but official product images sampled across current American, Scotch, and Australian releases print 700 ml or 70 cl on the bottle. This default is deliberately scoped to the online-exclusive shop and will be revised if Single Cask Nation lists a different bottle format there.

### Prefix the bottler name and use the first available positive variant

Shop titles identify the distillery and age but omit the bottler. The parser will normalize `Single Cask Nation ${title}` so the matching pipeline receives the full commercial identity. For each eligible product, it will select the first available variant with a positive decimal USD price and use the canonical product handle plus first official image.

### Fail malformed and empty runs at owned boundaries

Zod will validate the JSON payload and fields the parser owns. Malformed provider data will raise at the parser boundary. Unavailable and unsupported records remain intentional exclusions, while the existing `scrapePrices` guard will fail a complete run that emits no supported listings.

## Risks / Trade-offs

- [Single Cask Nation changes product taxonomy] -> Keep the whitelist local, cover it in fixtures, and fail an empty run so broad breakage is visible.
- [A different bottle format enters the online shop] -> Keep the 700 ml default scoped to this collection and revise it after the official product exposes the new size.
- [The shop changes its default market] -> Request the US country explicitly and preserve USD without currency conversion.
- [A product title already includes the bottler] -> Normalize the composed name and add a concrete regression only if the provider introduces such a record.

## Migration Plan

Add `singlecasknation` to the external-site enum and generate the PostgreSQL enum migration with `pnpm db:generate`. Deploy the migration before scheduling the source. Rollback consists of disabling or removing configured Single Cask Nation sources before reverting the application change; the additive enum value can remain safely if database rollback is impractical.

## Open Questions

None.
