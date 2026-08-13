## Context

Douglas Laing's Shopify storefront exposes a rendered Scotch collection and a structured collection JSON feed. The unscoped storefront varies market and currency by request location, while the explicit `/en-us` route consistently exposes US-dollar prices. The Scotch collection currently mixes whisky bottles with merchandise, gift sets, minis, multipacks, and a prepared cocktail, but its product types and tags provide owned classification, volume, ABV, and availability fields.

## Goals / Non-Goals

**Goals:**

- Register Douglas Laing as a scheduled external store-price source.
- Emit available, schema-valid 500 ml and 700 ml whisky bottle listings from the official US storefront.
- Keep market, currency, product eligibility, and provider failures deterministic and observable.
- Cover the provider contract with a representative fixture and an uncached live dry run.

**Non-Goals:**

- Import merchandise, gift cards, gift sets, minis, multipacks, gin, rum, or prepared cocktails.
- Scrape a geolocated market or convert Douglas Laing prices between currencies.
- Import historical or unavailable catalog records.
- Infer bottle identity beyond the existing store-price matching pipeline.

## Decisions

### Use the explicit US collection JSON feed

The scraper will request `/en-us/collections/scotch-whisky/products.json?limit=250&page=N`. This endpoint provides names, handles, product types, tags, variants, prices, availability, and official images without theme-specific HTML parsing. The explicit market route makes USD the stable currency contract. The unscoped feed was rejected because its market response depends on request location, and rendered HTML was rejected because it contains the same underlying data behind less stable selectors.

### Define supported bottles from provider-owned taxonomy

Eligible products must use a whisky product type (`Blended Malt`, `Blended Scotch`, `Single Grain`, `Single Malt`, or `Whisky`) and an exact `Vol: 50` or `Vol: 70` tag. The volume tag is interpreted as centilitres and converted to 500 ml or 700 ml. Products tagged `Whisky-Gift-Set` are excluded. An explicit numeric `Abv:` tag below 40 is also excluded, which removes the prepared cocktail while allowing valid bottles whose ABV tag is absent.

Name-only classification was rejected because the official fields describe the provider contract more precisely. Broadly accepting every item in the Scotch collection was rejected because that collection includes non-bottle records.

### Emit the first available positively priced variant

For each eligible product, the scraper will select the first available variant with a positive decimal USD price. Unavailable products and variants without a usable price are skipped. The canonical listing URL will use the explicit US product route and the first official product image when present.

### Fail malformed and empty runs at owned boundaries

Zod will validate the JSON payload and fields the parser owns. Malformed provider data will raise at the parser boundary. Unsupported records remain intentional exclusions, while the existing `scrapePrices` guard will fail a complete run that emits no supported listings.

## Risks / Trade-offs

- [Douglas Laing changes product types or tag spelling] -> Keep classification local, cover exact provider fields in fixtures, and fail an empty run so broad breakage is visible.
- [A valid new bottle uses another volume] -> Log the unsupported size and expand the explicit contract only after verifying the provider record and Peated's allowed volumes.
- [A prepared drink is incorrectly typed as whisky without a numeric ABV] -> Preserve the current owned-field contract and revise it when a concrete provider record proves another exclusion is needed.
- [The US assortment differs from other markets] -> Name the market in the source URL and store the displayed USD price without conversion.

## Migration Plan

Add `douglaslaing` to the external-site enum and generate the PostgreSQL enum migration with `pnpm db:generate`. Deploy the migration before scheduling the source. Rollback consists of disabling or removing configured Douglas Laing sources before reverting the application change; the additive enum value can remain safely if database rollback is impractical.

## Open Questions

None.
