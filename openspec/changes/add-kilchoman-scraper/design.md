## Context

Kilchoman's official `/whisky-shop/` page is a server-rendered WooCommerce catalog. Each product card includes a name, canonical product URL, official image URL, displayed GBP price, and a sold-out class when unavailable. The public WooCommerce category endpoint is healthy, but the product collection endpoint currently returns HTTP 500, so it is not a viable ingestion boundary.

The catalog is explicitly the distillery's single-malt whisky range. Current bottle releases use Kilchoman's standard 70 cl bottle format, while non-bottle bundles are identified in their card names.

## Goals / Non-Goals

**Goals:**

- Register Kilchoman as a scheduled external price source.
- Parse the official shop's current purchasable bottle cards into schema-valid store-price inputs.
- Keep provider failures visible through runtime validation and the existing empty-scrape guard.
- Cover the provider contract with deterministic fixtures and verify it against the live shop.

**Non-Goals:**

- Scrape sold-out releases, gift packs, merchandise, or experiences.
- Fetch each product detail page or depend on Kilchoman's unhealthy product API.
- Estimate taxes or replace Kilchoman's displayed price with a calculated VAT-inclusive amount.

## Decisions

### Parse the server-rendered shop catalog

The scraper will use the existing HTTP client and Cheerio to parse `li.product` cards on `/whisky-shop/`. This is the same content customers currently see and contains all fields Peated needs in one request. Depending on the WooCommerce product API was rejected because its product endpoint currently fails, and fetching every detail page would add latency and more failure points without improving the current catalog contract.

### Preserve the displayed GBP amount

The parser will convert the exact decimal amount rendered by Kilchoman into integer pence. The shop can label that amount as excluding tax for some visitor locations; the scraper will not infer a shipping destination or gross the amount up with a guessed rate.

### Apply the catalog's 700 ml bottle contract

Supported product cards in Kilchoman's single-malt shop will be emitted as 700 ml bottles. The page and official product media identify the range as 70 cl, but several card titles omit the size. Gift packs will be rejected by name and sold-out cards by availability markup so this default is not applied to unsupported packages.

### Treat malformed structure and empty output as failures

Every candidate card must contain a non-empty name, valid canonical URL, positive parsable price, and official image URL. Incomplete candidate cards will raise at the parser boundary instead of disappearing silently. Sold-out and explicitly unsupported cards are deliberate exclusions. The existing `scrapePrices` guard will fail a complete run that emits no listings.

## Risks / Trade-offs

- [Kilchoman changes its theme markup] -> Keep selectors local, validate required candidate fields, and fail an empty run so breakage is observable.
- [The catalog adds a non-700 ml bottle] -> Exclude explicit non-bottle bundles now and revisit the single-volume contract when the official catalog exposes another bottle format.
- [Displayed prices vary by visitor tax location] -> Preserve the provider's exact displayed amount rather than silently applying a jurisdictional assumption.
- [A malformed card blocks otherwise valid listings] -> Prefer visible provider-contract failure to persisting an incomplete or misleading listing.

## Migration Plan

Add `kilchoman` to the external-site enum and generate the corresponding PostgreSQL enum migration with the repository command. Deploy the migration before scheduling the new source. Rollback consists of disabling or removing configured Kilchoman sources before reverting the application change; the additive enum value itself is harmless if left in place.

## Open Questions

None.
