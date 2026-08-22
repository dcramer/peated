## Context

Whisky Saga publishes current Scotch reviews on a public Squarespace Scotland
category page. That page shows 20 current articles. Each review article exposes
a canonical URL, full publication timestamp, author, Bottle title, direct
tasting sections, and a 100-point score. The site publishes a much larger
sitemap, but current ingestion does not need it. Robots allow the category and
article paths and block Squarespace APIs, search, query filters, and internal
formats. The public privacy and editorial pages state no automated-access
restriction.

Peated already owns the shared review schema, current-window lifecycle, Bottle
matcher, sink, publication policy, robots enforcement, and request controls.

## Goals / Non-Goals

**Goals:**

- Add up to 20 current scored Scotch reviews without a schema or API change.
- Preserve canonical links, exact dates, Bottle names, reviewer attribution,
  and native 100-point scores.
- Run daily through the shared governed runtime.

**Non-Goals:**

- Backfill the full 2,000-plus article Scotland archive.
- Read the sitemap, pagination, search, query filters, or Squarespace APIs.
- Index non-Scotch categories or build a generic Squarespace crawler.
- Persist publisher HTML, images, introductions, comments, or full prose.

## Decisions

### Use the current Scotland category page

The adapter reads `/blog/category/Scotland` and accepts at most 20 unique
same-origin `/blog/<slug>` article links from its article cards. This gives the
requested Scotch focus with one bounded discovery request.

The homepage mixes Scotch with world whisky. The sitemap contains the full
archive. Query filters and Squarespace data formats are blocked by robots.

### Read article facts from their owning elements

The adapter reads the canonical link and page title from the article. It reads
the exact date and author from the article's public structured metadata. It
uses the title as the Bottle name and parses the published 100-point score with
the shared rating normalizer.

The adapter sends only paragraphs labeled nose, taste, palate, or finish to the
transient summary boundary. It excludes product background, images, comments,
scores, conclusions, and sign-off text.

### Reuse the shared current-review lifecycle

The adapter emits the shared article ingestion schema. The shared lifecycle
checkpoints each completed article and keeps only URLs in the current discovery
window. The shared runtime owns every request, and the shared sink owns matching
and storage.

## Risks / Trade-offs

- **A non-review enters the Scotland category** → Checkpoint a page only when it
  clearly has no tasting section. Fail a review-shaped page that lacks required
  facts.
- **Twenty new posts arrive between runs** → The daily 20-item window matches
  the publisher page size and bounds traffic. Older stored reviews remain.
- **Squarespace markup changes** → Keep parsing source-specific and cover the
  current category and article shapes with fixtures.
