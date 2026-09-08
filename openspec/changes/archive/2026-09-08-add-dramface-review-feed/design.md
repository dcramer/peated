## Context

Dramface publishes a public review index with 20 current article links. Each
article has a canonical URL, title, publication date, and writer. Review
sections contain Bottle details, a 10-point score, and review prose. One article
can contain several bottles or several reviews of one Bottle. Peated already
owns shared ingestion, Bottle matching, summary, policy, robots, and request
control boundaries.

## Goals / Non-Goals

**Goals:**

- Add current Dramface reviews without a schema or API change.
- Preserve each article's canonical URL, date, writer, Bottle facts, and native
  score.
- Preserve review section boundaries for multi-bottle and multi-writer pages.
- Run on a daily schedule with bounded and spaced requests.

**Non-Goals:**

- Backfill the full Dramface archive.
- Fetch Squarespace APIs, JSON views, search pages, or author query pages.
- Build a generic Squarespace or HTML review crawler.
- Ingest Dramface news or features.
- Store article HTML, publisher images, full review prose, or publisher TL;DR
  text.

## Decisions

### Use the public review index for bounded discovery

The adapter reads at most 20 current article links from `/all-reviews`. It
requests only canonical `/all-reviews/<year>/<slug>` pages. A run checkpoints
each emitted article URL so a deferred run does not repeat completed requests.

The Squarespace RSS and JSON views were rejected because Dramface's robots
rules block format query parameters. Sitemap discovery was rejected because it
would mix current reviews with the full archive.

### Keep parsing specific to Dramface

The adapter starts each review at a `Review` heading. The next large paragraph
supplies the Bottle text. The adapter reads the score within that section. It
uses a reviewer named in the section heading when present and otherwise uses
the article writer. It derives a stable review key from the canonical URL,
Bottle text, and reviewer.

A configurable parser was rejected because Dramface's review boundaries and
duplicate article summary fields are source-specific.

### Reuse the existing external-review boundary

The adapter emits the shared article ingestion schema. Only tasting prose from
the matching review section enters the policy-gated summary path. The adapter
excludes Dramface's TL;DR text. The scraper runtime enforces robots rules, exact
origins, request spacing, hourly quota, response limits, retries, and backoff.
Source policy controls visibility and model use, but it does not disable
fetching.

## Risks / Trade-offs

- **Article markup varies** → Accept only complete review sections and cover the
  current one-review, multi-bottle, and multi-writer forms with small fixtures.
- **The index contains category links and repeated links** → Require the
  canonical year-and-slug path and remove duplicates before applying the limit.
- **A review heading uses a short writer name** → Preserve that published name;
  use the article writer only when the section does not name a reviewer.
- **Page parsing changes** → Fail the article without deleting prior reviews.
  Fixture tests make the expected structure explicit.
