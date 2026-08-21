## Context

Words of Whisky publishes current scored reviews on its public homepage. The
homepage marks review cards with the tasting-notes category. Each article has
a canonical URL, exact publication time, writer, and one or more Bottle review
sections. Each section has a Bottle heading, tasting notes, conclusion, and
10-point score. Peated already owns the shared review schema, Bottle matcher,
sink, summary policy, robots enforcement, and request controls.

## Goals / Non-Goals

**Goals:**

- Add current Words of Whisky reviews without a schema or API change.
- Preserve canonical links, dates, writer, Bottle headings, and native scores.
- Preserve Bottle boundaries in multi-bottle articles.
- Run daily with bounded and spaced requests.

**Non-Goals:**

- Backfill the full tasting-notes archive.
- Use the WordPress API, RSS, search, or load-more endpoint.
- Build a generic WordPress review crawler.
- Store article HTML, images, full prose, or publisher conclusions.

## Decisions

### Use the public homepage for bounded discovery

The adapter reads at most 20 unique links from homepage article cards marked
with the tasting-notes category. It requests only canonical root-level article
paths. A run checkpoints each emitted article URL so a deferred run does not
repeat completed requests.

The full tasting-notes index was rejected because it exposes the complete
archive. RSS and WordPress endpoints are not needed for the current feed.

### Keep parsing specific to Words of Whisky

The adapter reads article metadata from the main post wrapper. Each level-two
heading in the entry body starts one Bottle review. The next publisher review
block supplies that section's score. The adapter derives a stable review key
from the canonical URL, Bottle heading, and writer.

A generic WordPress parser was rejected because the review headings and score
blocks come from this site's theme and review plugin.

### Reuse the existing external-review boundary

The adapter emits the shared article ingestion schema. Only the tasting-note
paragraphs between a Bottle heading and its score block enter the policy-gated
summary path. Publisher introductions and conclusions stay out of that input.
The shared runtime owns all network requests. Source policy controls display
and model use, but it does not disable fetching.

## Risks / Trade-offs

- **Homepage layout changes** → Require tasting-notes article cards and cover
  the current discovery markup with a small fixture.
- **Article markup changes** → Accept only complete Bottle sections and cover
  current single- and multi-bottle forms with fixtures.
- **A heading is not a Bottle review** → Require a matching 10-point score
  block before emitting the section.
- **The homepage window changes during a deferred run** → Keep only cursor URLs
  that remain in the current bounded window.
