## Context

Saved scraper rules currently parse either external reviews or store prices. Price results require a price, currency, and volume; review results require article data. The older Bottle adapter can return a product without a price, but it writes directly to Bottle records. Administrator-created rules need a safer path.

`BottleObservation` cannot store an unmatched product because it requires a known Bottle. Official catalogs therefore need their own saved record before any later Bottle matching.

The scraper source table currently permits only one configured source per external site. This change targets no-price catalogs first and does not change that constraint.

## Goals / Non-Goals

**Goals:**

- Parse official producer catalogs without requiring a review or purchasable price.
- Preserve the source product ID or URL, selected Bottle details, source page, and last-seen time.
- Make collected listings visible to administrators.
- Make repeat and partial runs safe: no duplicates and no deletion based on absence.
- Preserve every existing stored review and price rule revision.

**Non-Goals:**

- Matching listings to Bottles or creating, updating, merging, or deleting Bottles.
- Creating Bottle references, Bottle observations, reviews, or store prices.
- Automatically retiring listings that disappear from one run.
- Running both catalog and price configured sources for the same external site.
- Generic Shopify or WooCommerce API adapters.
- Copying producer descriptions or images into Bottle records.

## Decisions

### Add a distinct catalog source kind

Add `catalog` beside `review` and `price`. The chosen purpose remains clear in setup, preview, run records, and access checks. Making price optional for a price source could send products that are not for sale into price matching.

### Add a new rule version without changing old ones

Add a new rule version for catalog parsing. Continue to read every older version with its original schema. A catalog product requires the displayed name and accepts a preferred page URL, product ID, image URL, volume, ABV, stated age, edition, and release year. It reuses the existing rules for reading page values.

### Save unmatched products in `catalog_listing`

Each listing belongs to an external site. It stores the product page URL, optional product ID, product name, optional image URL, supported bottle details, a hash used to detect changes, and first- and last-seen times. It has an internal database key rather than a public Peated ID because it is not a public catalog record.

The product ID identifies a listing when present; otherwise, the product page URL does. The name never identifies a listing. Saving rejects a product ID and URL that point to 2 different listings. Database locks prevent 2 runs from creating the same listing at once.

Alternative considered: store unmatched products as Bottle observations. Rejected because Bottle observations require a known Bottle, and that rule should remain intact.

### Collection does not change Bottles

A catalog run validates and saves listings only. It does not try to match Bottle references. This makes setup and repeat runs safe before Peated has a matching policy.

### Absence only affects last-seen state

When a run sees a product, it updates `lastSeenAt`. When a run does not see a product, it changes nothing. Catalog pages can be incomplete, regional, redesigned, or temporarily unavailable, so absence does not prove that a Bottle or release was removed.

### Let administrators inspect collected products

Provide an administrator-only, paged product list and counts for saved details. Preview uses the same catalog parser but does not save listings. Raw page content and prose are not returned or stored.

## Risks / Trade-offs

- [A source changes product URLs or IDs] → Detect conflicts, preserve both existing listings, and reject the new result for review instead of silently joining records.
- [A list page pairs facts from different variants] → Keep the initial field set small and require detail-page parsing; add native commerce adapters later for multi-variant shops.
- [A run is partial] → Never hide or delete listings based on absence.
- [Administrators cannot review saved products] → Ship the product list and detail counts with storage.
- [Rule evolution changes old source behavior] → Freeze prior schemas and add catalog parsing only in a new rule version.
- [One source per site blocks a later Ardbeg price source] → Start with no-price sources and design source coexistence separately.

## Migration Plan

1. Add the catalog source kind, catalog-listing table, indexes, and relations; generate the migration with the repository migration command.
2. Deploy read/write code that understands the new kind and table while leaving existing sources unchanged.
3. Add administrator setup, preview, the product list, and detail counts.
4. Configure one no-price official producer source only after source terms, robots rules, parsing preview, and filters are reviewed.

Rollback disables catalog sources before reverting application code. Saved catalog listings do not affect public Bottle data. Do not remove the enum value or table while catalog sources or listings exist.

## Open Questions

- Which no-price source should be the first production pilot after the generic path is deployed?
- Should a future source model allow one source per `(externalSiteId, kind)`, or should one catalog run also create optional store prices?
- Which moderation task should own later Bottle matching and new-Bottle proposals?
