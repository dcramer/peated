## Context

Dramfool's Squarespace shop exposes its current catalog at `/shop?format=json`. The response currently contains all shop items in one collection and includes the fields Peated needs at variant level: title, relative product URL, image, option attributes, stock, regular and sale GBP prices, and product type. Products can mix full bottles with sample variants, while the collection also contains rum, events, merchandise, and informational products.

The existing scraper boundary already owns deduplication, empty-run failure, batching, dry runs, and durable external-site run tracking. This source only needs to validate the provider response and translate eligible variants into `StorePrice` records.

## Goals / Non-Goals

**Goals:**

- Ingest in-stock full-bottle whisky variants from Dramfool's official shop.
- Derive price, volume, product URL, and official image from the structured provider response.
- Preserve Dramfool's bottler identity even when an individual release title omits the name.
- Keep malformed or unsupported individual records observable without discarding valid siblings.

**Non-Goals:**

- Ingest samples, rum, tasting tickets, glassware, or records without an explicit supported bottle size.
- Infer volume from prose or a product title when the structured size attribute is absent.
- Add a browser runtime, tax conversion, or provider-specific persistence behavior.

## Decisions

### Use the public structured collection response

The scraper will request the official shop with `format=json` and validate the owned response shape with Zod. This avoids brittle HTML selectors and individual product requests while retaining the provider's variant-level stock and price fields. Because the collection is delivered as one response, the shared page callback will request it only for page one and return no records for later pages.

### Select variants by explicit size and stock

Each physical-product variant is evaluated independently. A case-insensitive `ml`, `cl`, or `l` parser converts the structured `Size` attribute to milliliters before checking Peated's allowed volumes. This admits equivalent full-bottle formats without accepting samples. A variant is purchasable when inventory is unlimited or its stock count is positive, and it must have a positive GBP regular price or positive active sale price.

### Require structured evidence instead of classifying shop prose

The current whisky bottles expose supported `70cl` variants, while rum, events, merchandise, and informational records either lack a `Size` attribute or expose unsupported formats. Requiring a supported explicit size makes those records ineligible without maintaining a speculative title blacklist. Records with recognizable but invalid fields are skipped with a structured scrape warning.

### Preserve source identity and reuse shared normalization

Titles that do not already contain `Dramfool` will be prefixed with `Dramfool` before passing through `normalizeBottle`. Relative product paths become canonical official URLs with `absoluteUrl`, and the collection image is retained. The shared `scrapePrices` boundary will deduplicate by normalized name and volume and raise its existing failure if the complete run emits no supported listings.

## Risks / Trade-offs

- [The provider removes or changes the JSON response] → Top-level schema validation or the shared empty-run failure makes the run fail visibly; deterministic fixtures keep the owned contract explicit.
- [A non-whisky product gains a supported size option] → The scraper trusts the shop's current structured merchandising contract; live QA and fixtures cover the catalog shape, and a future explicit category signal can be adopted if the provider adds one.
- [A full bottle omits its structured size] → Skip it with a warning rather than infer a potentially wrong volume from prose.
- [The provider begins paginating the collection] → The current response contains the entire catalog and has no pagination metadata; live QA checks the item count before publication.
- [Tax-inclusive pricing depends on visitor region] → Record the GBP amount returned by the same public catalog endpoint used by the worker, without guessing or applying a tax adjustment.

## Migration Plan

Generate the PostgreSQL enum migration after registering `dramfool` in the external-site type list. Deploy the migration before workers can schedule the new source. Rollback consists of disabling/removing the configured external site; PostgreSQL enum values are intentionally left in place rather than destructively removed.

## Open Questions

None.
