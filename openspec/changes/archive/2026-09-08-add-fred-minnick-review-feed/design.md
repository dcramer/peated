## Context

Fred Minnick publishes current review articles as normal WordPress posts. The
public `/reviews/` page is empty, and the main RSS feed is limited to a small
news-heavy window. The public sitemap index lists bounded post sitemaps and is
allowed by the site's robots rules. Robots also specify a 30-second crawl
delay. Current review articles identify one Bottle in the title and publish an
explicit date, but they do not publish a stable numeric or letter score.

Peated already owns the shared review schema, current-window lifecycle, Bottle
matcher, sink, publication policy, robots enforcement, and request controls.

## Goals / Non-Goals

**Goals:**

- Add up to five recent single-Bottle Fred Minnick reviews without a schema or
  API change.
- Preserve canonical links, explicit dates, Bottle names, and reviewer
  attribution.
- Run daily with a bounded discovery window and a 30-second request delay.

**Non-Goals:**

- Backfill the full site or its older review custom-post archive.
- Parse rankings, awards, comparison articles, or multi-Bottle videos.
- Request WordPress APIs, search pages, or pagination.
- Invent a score when the publisher does not provide one.
- Build a generic sitemap or WordPress crawler.

## Decisions

### Use the newest two post sitemaps

The adapter reads the public sitemap index and only the newest two post
sitemaps. It accepts up to five same-origin article URLs whose slug begins with
`review`, `bourbon-review`, or `whiskey-review`. It rejects plural comparison
titles and unrelated URLs. This window includes recent reviews even when the
main feed is filled by news.

Using the empty Reviews page cannot discover work. Using the short main feed
would often return no reviews. Reading every sitemap would turn this slice into
an archive crawl.

### Keep article parsing source-specific

The adapter reads the canonical URL, title, and explicit article date from the
main article. It removes the supported review prefix from the title to form the
Bottle name. It attributes the review to Fred Minnick because the indexed
article summarizes his published tasting, even when another site contributor
prepared the post.

The adapter keeps the native score and normalized rating null. It sends only
paragraphs that describe nose, palate, taste, or finish through the existing
transient summary boundary. It excludes introductions, prices, navigation,
related links, and site furniture.

### Reuse the shared current-review lifecycle

The adapter emits the shared article ingestion schema. The shared lifecycle
checkpoints each completed article and keeps only URLs in the current discovery
window. The shared runtime owns every request, including the 30-second spacing,
and the shared sink owns matching and storage.

## Risks / Trade-offs

- **A new post sitemap pushes an older review outside the two-map window** → A
  completed review already remains stored; the bounded feed only needs current
  discovery.
- **A comparison article uses a singular review slug** → Require a single
  supported review title and one derived Bottle name before emission.
- **Current review markup changes** → Fail the review-shaped article without a
  checkpoint and cover the verified markup with a fixture.
- **The source publishes reviews infrequently** → A successful zero-item run is
  expected; the feed adds new reviews when they appear without crawling news.
