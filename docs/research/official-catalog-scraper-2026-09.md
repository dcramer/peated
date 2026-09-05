# Official Product Catalog Scraper Research — September 2026

Initial audit: 2026-09-05. This document records source and architecture
research. It does not define runtime behavior or grant permission. Recheck a
site's current pages, robots rules, and terms before enabling collection.

This audit covers sources for automated catalog collection. For broader Bottle
research, see [Finding Whisky Catalogs](./catalog-research-sources-2026-09.md)
and [Catalog Source Examples](./catalog-research-examples-2026-09.md).

## Summary

Peated can configure HTML scrapers for reviews and store prices, but not for a
producer's product catalog when no review or store price exists. Price rules
require a name, price, currency, and volume. The older Bottle adapter can omit
price, but it writes directly to Bottle records and administrators cannot use
it to configure a source.

Add `catalog` as a scraper source kind. Save each product under its source,
using the source's product ID or preferred page URL. Keep its name, selected
bottle details, and last-seen time without creating, changing, merging, or
deleting a Bottle.

The smallest useful first release is collection and inspection only. Bottle
matching, creation proposals, and catalog updates should be a second change.
This separation proves the source rules and saves the source details before
any Bottle changes are allowed.

## Source Opportunity

The following live surfaces were checked on 2026-09-05. Product counts and
availability will change. "Public catalog" means that an unauthenticated
request returned product records; it does not by itself grant permission to
copy descriptions or images.

### Shops With Prices

| Source                                                                                                                                                                                                              | Observed surface                                                                                                                                                                                   | Initial assessment                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ardbeg](https://www.ardbeg.com/en-gb/collections/all-whisky)                                                                                                                                                       | Server-rendered product links and GBP prices; a public [Shopify catalog](https://www.ardbeg.com/products.json?limit=250) returned stable product and variant IDs, availability, prices, and images | Best first source. The page displayed 21 of 25 products. Prefer structured Shopify data when a native adapter is justified; configured HTML rules can cover the visible collection.                                  |
| [Bunnahabhain](https://bunnahabhain.com/collections/whisky), [Tobermory and Ledaig](https://tobermorydistillery.com/collections/whisky), and [Deanston](https://deanstonmalt.com/collections/whisky)                | Three closely related Shopify storefronts with public catalogs, product pages, prices, and availability                                                                                            | One parser or adapter pattern could cover all three. Exclude gift cards, gift sets, personalized products, and miniatures. Some pages need a reviewed fixed 700 ml value because volume is not consistently visible. |
| [Cotswolds Distillery](https://www.cotswoldsdistillery.com/collections/english-whisky)                                                                                                                              | Server-rendered collection with product links and GBP prices; public Shopify catalog                                                                                                               | Strong candidate. Exclude liqueur, new make, bundles, gifts, and small formats.                                                                                                                                      |
| [The Glenturret](https://theglenturret.com/collections/whisky)                                                                                                                                                      | Public Shopify catalog and dedicated whisky collection                                                                                                                                             | Strong candidate. Exclude gin and gifts. Treat numbered sale variants carefully when they identify physical bottle numbers rather than marketed editions.                                                            |
| [Isle of Raasay](https://raasaydistillery.com/shop/)                                                                                                                                                                | A public [WooCommerce Store API](https://raasaydistillery.com/wp-json/wc/store/v1/products?per_page=100) returned stable IDs, categories, stock, prices, currency, URLs, and images                | Good native-adapter candidate. The normal shop page sometimes returned a challenge page, so configured HTML setup may be unreliable.                                                                                 |
| [Lindores Abbey](https://lindoresabbeydistillery.com/shop/)                                                                                                                                                         | Simple WooCommerce shop and public product API                                                                                                                                                     | Easy but small source. Exclude vouchers, merchandise, tours, and new make.                                                                                                                                           |
| [Glen Scotia](https://www.glenscotia.com/collections/whisky), [Loch Lomond](https://www.lochlomondwhiskies.com/collections/single-malt-whisky), and [The Lakes](https://www.lakesdistillery.com/collections/whisky) | Public Shopify catalogs with many whisky records                                                                                                                                                   | Technically promising but noisier. Require collection-specific selectors and filters for partner releases, gifts, personalized bottles, bundles, gin, and other spirits.                                             |
| [The English Distillery](https://www.englishwhisky.co.uk/collections/all)                                                                                                                                           | Public Shopify catalog with whisky and non-whisky products                                                                                                                                         | A variant-aware adapter is safer than HTML rules. Several products combine 20 cl and 70 cl variants, so independent price and volume selectors can create a false pair.                                              |
| [Wolfburn](https://wolfburn.com/pages/shop)                                                                                                                                                                         | Large public Shopify catalog                                                                                                                                                                       | Lower priority. It includes historical, collector, miniature, market-exclusive, and duplicated-format records that need strong filters.                                                                              |

The codebase already contains registered or legacy support for official shops
including Bruichladdich, Kilchoman, GlenAllachie, Nc'nean, and Edradour. Their
production activation state was not checked in this audit.

### Catalogs Without A Purchasable Price

These sources show why catalog collection should not require a review or store
price:

| Source                                                                                | Useful producer evidence                                                                                               | Price limitation                                                                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Benriach](https://www.benriachdistillery.com/our-whiskies/the-forty-core-range/)     | Stable product name, age, ABV, cask composition, smoke level, image, and tasting information                           | "Buy now" does not expose a direct producer-store price.                                                                     |
| [Glenfiddich](https://www.glenfiddich.com/en-us/glenfiddich-21-year-old-gran-reserva) | Stable name, age, ABV, volume, series, image, and release description                                                  | Product page is a catalog record, not a priced listing.                                                                      |
| [The GlenDronach](https://www.glendronachdistillery.com/product/ode-to-the-dark/)     | Stable name, ABV, cask type, collection, image, and release description                                                | Some visitor-centre pages quote in-person prices, but product pages do not provide online stock and purchase state.          |
| [Springbank](https://www.springbank.scot/whisky/springbank-range/)                    | Exact edition, release year, age, ABV, cask composition, outturn when stated, image, and an official recommended price | The range page is not an online store and has no purchasable-stock signal. A recommended price must not become a StorePrice. |

## Boundary Before This Change

Before this work, the configured scraper supported only `review` and `price`:

```text
public list page
      |
      v
configured list and detail rules
      |
      +--------------------+
      |                    |
      v                    v
 review article       store price
      |                    |
      v                    v
external review        price matching
storage and policy     proposal workflow
```

Relevant owners:

- `apps/server/src/scraper/configured/rules.ts` owns the two source kinds and
  requires `price`, `currency`, and `volume` for a price product.
- `apps/server/src/db/schema/scrapeSources.ts` stores the source kind and one
  active version of its rules.
- `apps/server/src/scraper/configured/runtime.ts` chooses where to save reviews
  or store prices.
- `apps/server/src/db/schema/bottles.ts` requires every
  `bottle_observation` to have a validated `bottleId`. An unresolved source
  product cannot be stored there.
- `apps/server/src/scraper/adapters/legacyBottle.ts` accepts a Bottle with an
  optional price, but it saves Bottle data directly. It is not safe for rules
  created by an administrator.

`BottleObservation` does not fill this gap. It records source details after a
Bottle is known. A catalog scraper needs to save a product before it is matched
to a Bottle.

## Implemented Model

Use `catalog` for the scraper source kind and `catalog_listing` for the saved
source record. "Catalog" describes the producer's product catalog. It does not
mean the product is a Peated Bottle record.

```text
official product catalog
          |
          v
 saved rules or code reader
          |
          v
   CatalogListingInput
          |
          v
 save catalog_listing
          |
         +-----------------------------+
     first release                later change
          |                            |
          v                            v
 preview, product list,       Bottle matching,
 source health                create proposals,
                               BottleObservation
```

### Parsed Product

Require only the product name. Save these details when the page provides them:

- `name`: the producer's displayed product title;
- `url`: the preferred product page on the same website, defaulting to the
  fetched detail URL;
- `externalProductId`: a stable producer or shop-platform product ID;
- `imageUrl`: the source image URL, which is not copied to a Bottle;
- `volume`, `abv`, and `statedAge`; and
- `edition` and `releaseYear`.

Do not store the full page, product description, or tasting-note prose. The
product page URL and a content hash are enough to show where the details came
from and detect a change. This reduces copyright, storage, and model-input risk.

A version 7 rule uses the existing version 6 list shape:

```json
{
  "kind": "catalog",
  "products": {
    "oneProductPer": "article.product-card",
    "link": "a[href]",
    "skipWhen": null,
    "nextPage": "a[rel=next]",
    "limit": 99
  },
  "product": {
    "name": { "try": [] },
    "url": null,
    "externalProductId": null,
    "imageUrl": null,
    "volume": null,
    "abv": null,
    "statedAge": null,
    "edition": null,
    "releaseYear": null
  }
}
```

Each product field uses the existing page-reading and cleanup rules.

### Saved Source Record

A new `catalog_listing` table should own at least:

- an internal primary key;
- `externalSiteId`;
- stable external product ID when supplied;
- preferred product page URL;
- product name shown by the source;
- source image URL;
- supported bottle details;
- a hash of the name and bottle details, used to detect changes;
- first-seen and last-seen timestamps; and
- created and updated timestamps.

Use the external product ID to identify a listing when present and the product
page URL otherwise. Reject a product ID and URL that point to 2 different saved
listings. Do not use the product name as its ID. Repeat runs must update the
same listing instead of creating a duplicate.

A missing listing on a later run must not delete a Bottle, hide a Bottle, or
assert that the release was withdrawn. Partial runs, regional storefronts,
temporary stock changes, and site redesigns all make absence weak evidence.
Record `lastSeenAt`. Add removal or retirement rules only after a separate need
and design.

## First Release: Collection Only

The first release should stop at saved catalog products. It needs:

1. `catalog` in the application and database source-kind lists. Generate
   the migration with `pnpm db:generate`.
2. A frozen version 6 rules schema and a version 7 schema that adds catalog
   rules without changing how stored version 6 rules are interpreted.
3. Catalog list and product-page parsing, validation, and preview output.
4. Repeat-safe catalog-listing storage.
5. Setup-agent discovery, instructions, `check_rules` output, and fixtures for
   catalog pages.
6. Administrator source creation, rule editing, previews, run health, a product
   list, and counts for saved product details.
7. Focused parser, preview, collection, storage, route, and UI checks.

Collection-only acceptance criteria:

- An administrator can choose "Official product catalog," supply a starting
  URL, review generated rules, preview extracted details, and activate them.
- A collection run writes catalog listings and no review, StorePrice, Bottle,
  BottleReference, or BottleObservation rows.
- Replaying a page does not create a duplicate listing.
- A changed name or bottle detail updates the saved product and its change hash
  without changing Bottle data.
- A missing page or incomplete run does not delete or retire anything.
- Preview and normal logs exclude page bodies, producer prose, headers,
  cookies, and other sensitive request data.

This release is useful only if administrators can inspect the collected
products. Otherwise it stores data that nobody can review.

## Later: Bottle Resolution

Bottle resolution should be a separate reviewed change. The existing
`resolveScrapedBottleReferenceTarget` can provide exact reference matches and
classifier results, but its current `create_bottle` path can immediately write
Bottle data. Do not call it while collecting products. First decide how people
will review matches and when automation is allowed.

A safe initial resolution policy would be:

- exact accepted Bottle references may attach a listing to the active Bottle;
- classifier matches and new-Bottle drafts are stored for moderator review;
- conflicting details produce a Suggested Change or unresolved finding, never a
  direct update;
- no automatic merge, BottleGroup assignment, Series assignment, or populated
  field replacement;
- approval rechecks the listing's change hash and current Bottle state; and
- an approved assignment creates a `bottle_observation` with source type
  `catalog_listing`, exact source URL, title, and parsed details.

This likely needs either a catalog-specific match proposal or a shared Bottle
match proposal that also works for store prices.
Do not create a fake StorePrice or reuse a review row merely to reach their
existing queues.

Matching also requires decision history and moderator tools for catalog
products. Bottle images should remain source links until reuse terms are
recorded and a person or approved policy permits copying the image.

## One Source Per Site

`scrape_source` currently has a unique constraint on `externalSiteId`, so one
site can have only one configured source. This is enough for a no-price
producer catalog, but it creates a conflict for a shop such as Ardbeg that can
provide both bottle details and prices.

There are three options:

1. Allow one source per `(externalSiteId, kind)`. This is simple but may fetch
   the same product pages twice.
2. Collect the product once and create a StorePrice when it also has a valid
   price. This avoids duplicate requests but broadens the first change.
3. Keep catalog and price mutually exclusive per site. This is the smallest
   change but discards useful data and should be temporary.

For the collection-only first release, keep catalog price-free and use it for
sources without a valid StorePrice. Before enabling catalog collection on an
existing price site, choose option 1 or 2 explicitly. Option 2 is simpler in
the long term, while option 1 is safer to add in steps.

## Shopify And WooCommerce Readers

Configured rules read HTML only. They do not execute scripts, send arbitrary
headers, or parse Shopify and WooCommerce JSON. Keep the saved product format
independent of how Peated reads the website, so saved rules and code-owned
sources can both emit `CatalogListingInput`.

A later generic Shopify adapter would safely pair price, availability, volume,
barcode, product ID, and variant ID. That is especially valuable for products
with several sizes. A WooCommerce Store API adapter would provide the same
benefit for Raasay and Lindores. These adapters still require filters and
reviewed matching rules for each source. The shop platform does not prove that
every product is whisky or that every variant is a distinct Bottle.

## Safety Rules

- Source details do not automatically become Bottle facts.
- Never construct a stable Bottle name from age, year, ABV, strength, cask
  number, volume, or package text.
- Never infer Brand, distillery, bottler, Series, or ownership from hostname or
  page placement.
- A product variant that differs only by volume or packaging is not a new
  Bottle.
- Preserve exact product IDs, URLs, source titles, and change hashes. Do not
  combine products only because their normalized names match.
- Do not copy producer images without reviewed reuse terms, a source URL, and an
  exact Bottle match.
- Enforce robots, request limits, response limits, same-origin links, and the
  existing preview-before-activation requirement.
- Terms and licensing review is required before activation. The technical
  source audit above is not permission to crawl or republish content.
- A parser or source change never updates Bottle fields by itself.

## Open Decisions

1. Should administrators be able to export collected catalog products?
2. Should a source with both bottle details and prices use 2 sources, or should
   one run also create a StorePrice?
3. Should catalog matching ever create a Bottle automatically, or should every
   new release begin as a moderator-reviewed proposal?
4. How should a changed product hash affect an existing Bottle match? The match
   should be marked for another look, but automatic clearing may lose a correct
   reviewed link.
5. Does Admin need a source-level declaration that a site is an official
   producer source? If added, it must be a reviewed relationship, not a fact
   inferred from the domain name.

## Recommendation

Start with the collection-only catalog kind and one no-price official source,
such as Benriach or Glenfiddich. This validates the parser, saved rule versions,
product matching keys, previews, and source health without risking Bottle
changes.

Use Ardbeg as the next integration test after deciding how catalog and price
sources coexist. Then design Bottle matching and moderator review using the
stored catalog products as the source record.
