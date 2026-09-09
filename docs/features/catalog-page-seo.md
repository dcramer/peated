# Web search and catalog SEO

Peated helps people find public whisky records. Search results should lead to a
useful, stable page rather than a duplicate filter, an account screen, or
private member activity. Titles and descriptions must match the page. They must
not invent facts, expose private data, or add text only for search engines.

This document owns Peated's web search policy. It describes current behavior
first. The final section records opportunities, not implementation promises.

## Pages in search

| Page                                                                             | Rule                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Home, catalog browse, Bottles, brands, producers, Series, countries, and regions | Canonical public pages are included in sitemaps. Unfiltered pagination can be indexed.                                                 |
| Public member profile overviews, tastings, and member reviews                    | Pages can be indexed and are discovered through normal links. They are not included in catalog sitemaps.                               |
| Filtered, sorted, and personal catalog lists                                     | Pages use `noindex, follow`. Their links can still help crawlers find canonical records.                                               |
| Private profiles, tastings, and member reviews                                   | Private pages use `noindex` and omit personal search metadata and structured data. People without access receive a not-found response. |
| Authentication, account, editing, and member-only routes                         | Pages use `noindex, nofollow`. The shared `(layout-free)` layout applies this rule to add, edit, sign-in, and verification routes.     |
| Internal search                                                                  | Search results use `noindex, follow` so result links can still help discovery.                                                         |
| Member activity, library, and tasting tabs                                       | Tabs use `noindex, follow`. Search engines should index the public profile overview instead.                                           |
| Admin and health routes                                                          | `robots.txt` asks general crawlers not to crawl them. Admin pages also use `noindex`. Access control remains responsible for security. |

`noindex` and `robots.txt` are search instructions, not privacy controls. API and
page authorization must protect private records even when a crawler ignores
those instructions.

## Canonical URLs

Each public page names one preferred, or canonical, URL. Record URLs contain a
stored ID and the current display-name slug. The ID identifies the record; the
slug makes the URL readable. The request proxy redirects old slugs, merged IDs,
numeric-only Bottle and Series URLs, Peated IDs, and location slugs with the
wrong letter case. These redirects return HTTP 308 and preserve the rest of the
path and its query parameters. Unknown records return not found.

Catalog list metadata applies these rules:

- The first unfiltered page uses the browse URL as its canonical URL.
- Later unfiltered pages retain their `cursor` in the canonical URL. Each page
  is a distinct part of the list, not a duplicate of page one.
- Filters, sorting, and personal list parameters produce `noindex, follow` and
  collapse to the matching unfiltered canonical page.
- Tracking parameters such as `utm_*`, `source`, and `ref` do not change the
  canonical URL or indexing decision.

Bottle, brand, and producer overview pages publish the record's canonical URL.
Public Bottle price, tasting, and release tabs and brand or producer bottle,
portfolio, Series, tasting, and code tabs publish their own titles,
descriptions, and canonical URLs. Alias tabs use `noindex, follow`. Series and
location sections publish their own canonical URLs.

See Google's guidance for
[pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading),
[faceted navigation](https://developers.google.com/crawling/docs/faceted-navigation),
and [duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Metadata

`apps/web/src/lib/seoMetadata.ts` owns shared catalog metadata. Search, Open
Graph, and Twitter metadata use the same page title and description. Generated
descriptions use plain words. Stored names and descriptions retain their
meaning. Metadata contains no personal library counts or private Bottle lists.

Country and region tabs describe their own content. Bottle, brand, producer, and
Series helpers use the loaded record and a factual fallback when no stored
description exists. Reading metadata does not add browser JavaScript or load a
list.

`noIndexPageMetadata` applies to private pages, account pages, and forms.
`noIndexFollowPageMetadata` applies when a page should stay out of results but
its links should still be followed. Routes must reuse these values instead of
declaring their own robots rules. The `web-robots-metadata-owned` lint rule
checks this.

## Structured data

Structured data represents content already visible on the page:

- Bottle pages use schema.org `Product` and may include a current aggregate
  offer when price data is available.
- Public tasting and member review pages use `Review`. Member reviews include
  their stored 0–100 score. Tastings omit a numeric score because their ratings
  use names, not review scores.
- Series and location overviews use `CollectionPage` and `BreadcrumbList`.
- Brand, producer, and public member pages use `Organization` and `ProfilePage`
  respectively, with stable page URLs and IDs. Private profiles omit structured
  data.

Bottle pages do not publish `AggregateRating`. The stored Bottle median combines
Peated member reviews with third-party critic reviews, and it must not be
presented as a first-party aggregate. Structured data is serialized by the
shared helpers so stored text cannot close the script element.

## Sitemaps and bots

The root sitemap lists the preferred Bottle, brand, producer, Series, country,
region, and static pages. Region sitemaps are split by country. Child sitemaps
follow API pagination and use `updatedAt` only when the API supplies a reliable
value. Sitemaps use the public API without a signed-in member.

Tastings, member reviews, and member profiles are not in the sitemap. Search
engines can still find them through links from public pages. Adding a page to a
sitemap makes it easier to find, so sitemap entries are deliberate.

`robots.txt` currently blocks SemrushBot, GPTBot, and PerplexityBot. Its wildcard
rules allow other crawlers except on admin and health routes. These bot choices
are a product policy separate from page metadata and Google indexing.

## Server rendering and caching

Public search content is rendered on the server. The root layout remains dynamic
because it reads the signed-in session, while public data and sitemap responses
use the caching rules in [Web caching](../architecture/web-caching.md). Public
metadata, redirects, and sitemaps load without member credentials.

If a public API request fails, a search engine may see the page's error message.
That message must remain useful and factual. Public caching should reduce how
often search engines see a temporary failure.

Bottle rows use the shared rendering described in
[Bottle presentation](bottle-presentation.md). SEO does not own a separate
visual component.

## Opportunities

These are the highest-value follow-ups from the September 2026 review. Confirm
them with Search Console data before broad page or content work.

1. **Add useful category pages.** A page for a whisky category, flavor, cask, or
   age can answer a real question and link to records. Filter combinations
   should remain `noindex`. Do not add empty pages or generic search text just
   to cover keywords.
2. **Decide how much content a sitemapped record needs.** The sitemap now
   includes the category, rating, API, and update pages and uses the preferred
   SMWS code URL. Decide whether records with little public information belong.
   Decide separately whether selected public tastings or reviews belong.
3. **Link Bottle and brand structured data.** Brand, producer, and public
   profile data now use stable `@id` and `url` values. A Bottle's brand still
   needs a link to its public brand page. Only publish scores or prices that the
   page shows and Peated can support.
4. **Measure search and page speed.** Track indexed filter URLs, duplicate
   titles, failed page loads, Core Web Vitals, and sitemap coverage. Fix
   server-rendered errors and measured slowdowns before speculative performance
   work.
5. **Review AI bot access.** Decide whether blocking GPTBot and PerplexityBot
   still matches Peated's public-record mission. Do not change these rules as
   part of unrelated SEO work.
