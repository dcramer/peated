## Context

The Whiskey Reviewer publishes a dedicated Recent Reviews list on its public
homepage. The list currently contains five article links. Each current article
has a canonical URL, title, writer, one Bottle review, and a letter grade. The
article URL usually encodes the publication date. Peated already owns the
shared review schema, Bottle matcher, sink, summary policy, robots enforcement,
and request controls.

## Goals / Non-Goals

**Goals:**

- Add current The Whiskey Reviewer articles without a schema or API change.
- Preserve canonical links, dates when available, writers, Bottle names, and
  displayed letter grades.
- Run daily with six or fewer spaced requests.

**Non-Goals:**

- Backfill the alphabetical review archive.
- Request category pages, sitemaps, feeds, search, or WordPress APIs.
- Build a generic WordPress review crawler.
- Store article HTML, images, full prose, prices, or publisher conclusions.

## Decisions

### Use the homepage Recent Reviews list

The adapter reads at most five unique article links from the widget whose title
is Recent Reviews. It accepts only same-origin article paths with year and month
segments. A run checkpoints each emitted article URL so a deferred run does not
repeat completed requests.

The alphabetical review page was rejected for this slice because it exposes the
full archive. The general homepage article list was rejected because it mixes
reviews, news, interviews, and features.

### Keep article parsing specific to the publisher

The adapter reads the title and canonical URL from the main post. It reads the
writer from the direct `By` paragraph and the letter grade from the direct
`Rating` paragraph. It removes the final `Review` label from the title to form
the Bottle name. It reads a publication date from the current URL suffix when
that suffix is valid.

Only direct article paragraphs after the rating and before the price section
are eligible for summary input. Eligible paragraphs must contain tasting terms
such as nose, palate, or finish. This excludes the introduction, price, and
general conclusion in the current article form.

### Preserve letter grades with a deterministic numeric mapping

The shared score contract requires a numeric value and scale. The adapter keeps
the publisher's letter as the displayed score and maps grades to a 100-point
value for Peated's normalized field: A+ 100, A 95, A- 90, B+ 87, B 83, B- 80,
C+ 77, C 73, C- 70, D+ 67, D 63, D- 60, and F 0. The mapping is local to this
source and does not change shared schemas.

### Reuse the existing external-review boundary

The adapter emits the shared article ingestion schema. Review prose remains
transient. The shared runtime owns all network requests, and the shared sink
owns matching and storage. Source policy controls display and model use, but it
does not disable manual or scheduled fetching.

## Risks / Trade-offs

- **The widget title or markup changes** → Require the exact Recent Reviews
  widget and cover its current markup with a fixture.
- **The article form changes** → Require a title, writer, and recognized grade
  before emitting an observation.
- **A date is not encoded in a future URL** → Store a null publication date
  instead of inventing one or failing the article.
- **Letter grades are not numeric percentages** → Preserve the letter for
  display and keep the explicit conversion local to this adapter.
