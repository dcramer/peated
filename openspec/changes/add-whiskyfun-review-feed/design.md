## Context

Whiskyfun publishes an RSS feed with current article URLs, titles, dates, and
bottle names. Each article can contain several reviews. The article HTML uses
a repeated review cell with a bottle heading and a 100-point score. Peated
already has shared review ingestion, Bottle matching, summary, policy, robots,
and request-control boundaries.

## Goals / Non-Goals

**Goals:**

- Add current Whiskyfun reviews without a schema or API change.
- Preserve the publisher's canonical URL, date, reviewer, and native score.
- Support multi-bottle articles and safe resume after request deferral.
- Run on a daily schedule with bounded and spaced requests.

**Non-Goals:**

- Backfill the full Whiskyfun archive.
- Build a generic RSS or HTML review crawler.
- Store article HTML, publisher images, or full review prose.
- Add consensus scores or new Bottle-page presentation.

## Decisions

### Use the public RSS feed for bounded discovery

The adapter reads at most 20 current feed items. It skips clear non-whisky
article titles, then requests each remaining canonical article. The feed date
is the publisher date. A run checkpoints each emitted article URL so a deferred
run does not repeat completed article requests.

Direct archive discovery was rejected for this slice. It would add historical
pagination and a much larger request budget before current supply is proven.

### Keep parsing specific to Whiskyfun

The adapter reads review cells that contain one non-empty bottle heading and
one `SGP` score. It derives a stable review key from the canonical article URL
and normalized heading. It uses the page author metadata for the reviewer.

A configurable parser was rejected because Whiskyfun's legacy markup and
review boundaries are source-specific.

### Reuse the existing external-review boundary

The adapter emits the shared article ingestion schema. Review text exists only
in the observation passed to the policy-gated summary path. The scraper runtime
enforces robots rules, exact origins, request spacing, hourly quota, response
limits, retries, and backoff. Source policy controls visibility and model use,
but it does not disable fetching.

## Risks / Trade-offs

- **Legacy markup varies between articles** → Accept only complete review cells
  and fail an article that contains no valid reviews. Cover current variants
  with small fixtures.
- **The feed includes other spirits** → Skip titles with clear non-whisky
  spirit terms. Bottle matching remains the final publication boundary.
- **A daily feed item contains many reviews** → Emit one article observation
  with all valid reviews. The request count stays bounded by article count.
- **Feed or article parsing changes** → Fail the run without deleting prior
  reviews. Fixture tests make the expected structure explicit.
