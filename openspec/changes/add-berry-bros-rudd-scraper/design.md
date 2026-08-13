## Context

Berry Bros. & Rudd's UK search page server-renders its own-selection Scotch catalog. The filtered result currently spans two pages and exposes one desktop product card per listing plus a duplicate horizontal presentation of the same result. Desktop cards contain the owned fields Peated needs: title, current GBP price, bottle size, product link, official image, and an add-to-basket action.

The existing scraper boundary already owns pagination, deduplication, empty-run failure, batching, dry runs, and durable external-site run tracking. This source only needs to translate the provider's HTML contract into `StorePrice` records.

## Goals / Non-Goals

**Goals:**

- Ingest purchasable Berry Bros. & Rudd own-selection Scotch listings from the official UK catalog.
- Parse prices and bottle sizes from their displayed values without hardcoding individual products.
- Stop naturally on the first page without supported product cards and fail a complete empty run.
- Keep malformed or unsupported individual listings observable without discarding valid siblings.

**Non-Goals:**

- Scrape third-party bottlings sold by Berry Bros. & Rudd.
- Expand alternate sizes hidden behind individual product pages.
- Add a browser runtime or provider-specific persistence behavior.

## Decisions

### Use the filtered server-rendered search page

The scraper will request the official `Scotch Whisky` plus `Own Selection` search route with an explicit page number. Cheerio will parse only `div.sf-product-card[data-testid="product-card"]`, excluding the duplicate horizontal cards emitted for another responsive layout. This keeps the worker on the existing lightweight HTTP boundary instead of introducing browser automation or depending on undocumented client state.

### Require purchase eligibility and parse displayed commercial fields

A card is eligible only when its action text is `Add to basket`. The current `sf-price__regular` value is parsed as GBP minor units, including comma-separated amounts, and the displayed bottle-size text is parsed with a case-insensitive `ml`, `cl`, or `l` expression before validating against Peated's allowed volumes. This accepts equivalent provider formatting changes such as `70cl` or `700 ml` without guessing absent sizes.

### Treat cards as independent records

Recognizable desktop cards with missing, invalid, or unsupported fields will be skipped with a structured scrape warning. Valid sibling cards remain ingestible. If every page yields zero valid listings, the shared scraper boundary raises its existing empty-scrape error, turning a broad selector or provider-contract failure into a failed run instead of a successful zero-result run.

### Reuse shared normalization and pagination

Titles already contain the Berry Bros. & Rudd bottler name, so they will pass directly through `normalizeBottle`. Relative links become canonical official URLs with `absoluteUrl`; official image URLs are retained. `scrapePrices` will continue requesting pages until a page emits no eligible listings and will deduplicate by normalized name and volume.

## Risks / Trade-offs

- [The provider changes selectors or removes server rendering] → Per-card warnings cover partial breakage and the shared empty-run failure covers complete breakage; deterministic fixtures make the owned contract explicit.
- [An unsupported size appears] → Skip it with the raw name and parsed volume in a warning rather than attach an incorrect volume.
- [A valid page contains only unavailable products before later pages] → The shared pagination boundary stops at that page. The official catalog currently sorts all purchasable results into contiguous pages; live QA verifies this assumption before publication.
- [The same product appears in both responsive layouts] → Scope parsing to the fully populated desktop card selector and retain shared listing deduplication as a second guard.

## Migration Plan

Generate the PostgreSQL enum migration after registering `berrybrosrudd` in the external-site type list. Deploy the migration before workers can schedule the new source. Rollback consists of disabling/removing the configured external site; PostgreSQL enum values are intentionally left in place rather than destructively removed.

## Open Questions

None.
