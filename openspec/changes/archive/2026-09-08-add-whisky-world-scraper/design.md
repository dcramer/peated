## Context

The Whisky World renders its broad whisky catalog as public, paginated Visualsoft HTML. Its source-owned size facets provide an authoritative bottle-volume boundary that is absent from the product cards themselves. An uncached audit of the exact 70 cl facet found 2,734 cards across 57 pages, with 2,697 directly buyable products, stable product paths and IDs, complete GBP prices, and official images. The remaining cards were personalized engraving products whose action is `View` rather than `Buy`.

The broader catalog also exposes other supported sizes, but implementing several independently paginated facets would add orchestration and duplicate-handling complexity. The 70 cl facet alone provides the large-source coverage this change is intended to add.

## Goals / Non-Goals

**Goals:**

- Collect broad current GBP whisky prices from The Whisky World's exact 70 cl catalog.
- Use the provider's size facet and direct-buy action as the primary eligibility boundary.
- Reject clearly multiproduct and malformed offers conservatively.
- Keep source-contract failures visible while isolating malformed individual cards.

**Non-Goals:**

- Scrape other bottle-size facets, personalized products, unavailable products, gift sets, bundles, or multipacks.
- Infer volume from titles, prices, or general category membership.
- Model shipping eligibility, inventory quantity, currency conversion, or sale history.
- Create bottles or persist prices during local verification.

## Decisions

### Scrape the exact 70 cl facet page by page

The worker will request numbered pages from `/whisky-c7/70cl-t24` with the catalog's 48-product page size. This provider-owned facet is the volume authority, so every eligible result is emitted as 700 ml without product-detail requests or title inference. An empty product page ends pagination. A page with product cards but no supported listings fails explicitly so source drift cannot silently truncate a partial run.

Only this facet is included. Scraping the generic catalog would require thousands of product-detail requests to establish volume, while coordinating every supported size facet would multiply paging and deduplication concerns for limited additional coverage.

### Require the direct-buy action

A listing must expose the product card's exact `Buy` action. Cards that only expose `View` are not directly purchasable from the catalog and are excluded; the current examples are engraving and plaque customizations. This source-owned state is more reliable than guessing availability from CSS classes or titles.

### Parse narrow card-owned fields

The scraper will take the normalized title and canonical URL from the product title link, the GBP amount from the inclusive-price field, and the image from the card's lazy or eager image attributes. Product and image URLs must resolve to The Whisky World's HTTPS origin, and product paths must retain the provider's numeric product identity.

The lazy image attribute is preferred over a placeholder `data:` source. Prices must use a positive `£` decimal amount; the scraper will not infer another currency from browser state.

### Exclude clear multiproduct offers conservatively

Titles identifying gift sets or packs, tasting sets or packs, bundles, advent calendars, miniature sets or packs, numeric packs, numeric `Nx70cl` offers, or `set of N` offers are excluded. Generic words such as `collection`, `case`, `box`, `duo`, and `trio` are not exclusions because they occur in legitimate release names.

### Isolate malformed cards and retain complete-run failure

Invalid individual cards are warned about and skipped so one bad listing does not discard a valid page. A page with cards but no supported listings raises at the provider boundary. Request failures escape to the worker boundary, and a complete run with no cards fails through the existing `scrapePrices` guard.

## Risks / Trade-offs

- **The provider changes or removes its 70 cl facet** → The resulting empty scrape fails explicitly rather than reporting success.
- **The catalog markup changes partially** → Invalid cards are warned about, while fixture coverage owns the selectors and official-field validation.
- **A legitimate release title resembles a pack** → Use narrow phrase and numeric-pack patterns and retain known release terms in regression fixtures.
- **A non-70 cl bottle is misclassified by the provider** → Treat the provider's exact size facet as authoritative; revise only with concrete contradictory source evidence.
- **Other supported sizes remain uncovered** → Prefer the simple high-volume facet now and add another exact facet only when its incremental value justifies independent pagination and deduplication.

## Migration Plan

Deploy the registered worker, then configure The Whisky World through the existing administrative path. External-site types are stored as text and validated by the application, so no database migration is required. Rollback consists of disabling the source and worker job.

## Open Questions

None.
