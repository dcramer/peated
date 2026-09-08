## Context

The Whisky Study publishes current Scotch reviews on a public Squarespace
index. The first page shows 20 articles. Each article exposes a canonical URL,
publication timestamp, author, Bottle title, direct tasting sections, and a
100-point score. Robots allow the public index and article paths. They block
Squarespace APIs, search, query filters, and internal formats.

Peated already owns the shared review schema, current-window lifecycle, Bottle
matcher, sink, publication policy, robots enforcement, and request controls.

## Goals / Non-Goals

**Goals:**

- Add up to 20 current scored Scotch reviews without a schema or API change.
- Preserve canonical links, publication dates, Bottle names, reviewer
  attribution, and native 100-point scores.
- Run daily through the shared governed runtime.

**Non-Goals:**

- Backfill older index pages or the full sitemap.
- Read search, query filters, or Squarespace APIs.
- Index non-Scotch categories or build a generic Squarespace crawler.
- Persist publisher HTML, images, introductions, conclusions, or full prose.

## Decisions

### Use the first Scotch review index page

The adapter reads `/reviews-3` and accepts at most 20 unique same-origin
`/reviews-3/<slug>` article links from its article cards. It does not follow the
Older Posts link. This gives a bounded current feed with one discovery request.

The homepage mixes several whisky regions. Pagination and the sitemap expose
older content that is outside this change.

### Read article facts from their owning elements

The adapter reads the canonical link and article title from the page. It reads
the publication timestamp and author from public structured metadata. It
removes a trailing `Review` or `Shelf Review` label from the title for the
Bottle name. It parses the published 100-point score with the shared rating
normalizer.

The adapter sends only paragraphs labeled nose, taste, palate, or finish to the
transient summary boundary. It excludes product background, specifications,
images, final thoughts, scores, purchase links, and comments.

### Reuse the shared current-review lifecycle

The adapter emits the shared article ingestion schema. The shared lifecycle
checkpoints each completed article and keeps only URLs in the current discovery
window. The shared runtime owns every request, and the shared sink owns matching
and storage.

## Risks / Trade-offs

- **A non-review enters the Scotch index** → Checkpoint a page only when it has
  no direct tasting section. Fail a review-shaped page that lacks required
  facts.
- **More than 20 new articles arrive between runs** → The daily 20-item window
  matches the publisher page size and bounds traffic. Older stored reviews
  remain.
- **Squarespace markup changes** → Keep parsing source-specific and cover the
  current index and article shapes with fixtures and a governed live check.
