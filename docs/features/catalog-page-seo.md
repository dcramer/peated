# Catalog page SEO

Public bottle, producer, series, country, and region pages have page-specific
search and social metadata. The catalog browse pages use the same title,
description, and canonical URL in search, Open Graph, and Twitter metadata.
Generated descriptions use plain words; stored names and descriptions retain
their meaning. Metadata contains no personal library counts or bottle lists.

`apps/web/src/lib/seoMetadata.ts` owns catalog metadata. Country and region tabs
each describe their own content. Paginated lists retain `cursor` in canonical
URLs; filtered, sorted, and personal lists use `noindex, follow`. Tracking
parameters do not change the canonical URL. This follows Google's
[pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).

Series and location overviews use `CollectionPage` structured data with their
browse hierarchy. They do not claim that a series is one product or publish
invented ratings. `catalogStructuredData.ts` escapes stored text before embedding
it in a script element.

The request proxy resolves bottle and series IDs, merged records, stale name
slugs, and location slug casing before HTML streaming starts. Redirects return HTTP 308 and
preserve tabs and query parameters. Locations keep their existing country and
region slug URLs. Unknown records follow the normal not-found path. All proxy
identity reads and sitemap reads are anonymous.

The root sitemap includes catalog browse pages, series, countries, and regions.
Region sitemaps are split by country so a single request does not need to fetch
every country's regions. They include overview and browse tabs, follow API
pagination, and omit modification dates when the API has none.

Bottle rows on these pages use the shared rendering described in
[Bottle Presentation](bottle-presentation.md). SEO does not introduce a separate
visual component.
