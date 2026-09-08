## Context

Peated already stores a large canonical bottle catalog plus external reviews and store-price listings, but its public statistics only expose total bottles, entities, and tastings. Existing external-site health endpoints describe individual scraper runs; they do not answer how much of the active catalog those sources cover or how many source items remain unmatched.

This first aggregation slice needs an exact, inexpensive-to-maintain baseline that uses current table semantics. Active bottles are independently complete Bottle rows (`groupId` is present) without a tombstone. Public review and price reads already define visible source items as rows where `hidden = false`.

## Goals / Non-Goals

**Goals:**

- Give admins one read-only snapshot of active catalog content coverage.
- Measure distinct active bottles supported by visible reviews and price listings.
- Measure visible review and price inventory split into matched and unmatched items.
- Reuse the same active-bottle and visibility rules as current product reads.
- Prove the counting contract through the real route and test database.

**Non-Goals:**

- A frontend dashboard, historical snapshots, trends, or scheduled materialization.
- Source freshness or per-source health; existing external-site health remains the current operational view.
- Percentages or quality scores that can be derived from exact counts.
- Richer review evidence, release/news ingestion, grounded AI synthesis, bottle-page changes, feeds, follows, or alerts.

## Decisions

### Add a separate admin endpoint

Add `GET /admin/catalog/coverage` as `admin.catalogCoverage` rather than extending public `GET /stats`. The report is operational, has a different audience, and performs more work than the lightweight public counters. Admin authorization also keeps future source-quality details from becoming an accidental public API commitment.

Alternative considered: add fields to `/stats`. This would couple public about-page traffic and its stable response to internal aggregation metrics.

### Return exact counts grouped by domain

Return three groups:

- `bottles`: `total`, `withDescription`, `withImage`, `withReviews`, and `withPriceListings`.
- `reviews`: `total`, `matched`, and `unmatched` visible review items.
- `priceListings`: `total`, `matched`, and `unmatched` visible store-price items.

Counts preserve the facts and let later clients derive percentages without rounding behavior in the API. “Price listings” is used instead of “prices” because this slice does not impose a freshness window.

### Keep catalog and source-inventory semantics separate

Bottle coverage only counts active bottles and uses separate distinct Bottle ID aggregates so several reviews or listings for one bottle count once. Keeping review and price coverage in independent queries avoids multiplying rows when one Bottle has several of both. Source inventory counts every visible item and defines matched as a non-null Bottle ID. A source item attached to a retired Bottle can therefore remain matched while not contributing to active catalog coverage; this distinction exposes rather than hides cleanup work.

Descriptions and images count only non-null, non-blank values. Hidden reviews and listings do not contribute to either source inventory or bottle coverage, matching current public list behavior.

### Compute on demand from existing tables

Use a small fixed set of aggregate SQL queries and no schema changes. At the current catalog size, on-demand admin access is simpler than materialized counters or a scheduled snapshot. The route owns the definition so future dashboards and CLI commands share one contract.

## Risks / Trade-offs

- **Aggregate queries become slow as the catalog grows** → Keep the endpoint admin-only and rely on existing bottle/source indexes; measure before introducing materialization.
- **All-time price listings overstate current availability** → Name the field `withPriceListings`; add explicitly defined freshness metrics in a later slice.
- **A single snapshot cannot show progress over time** → Defer persistence until the baseline report is useful and the desired reporting cadence is known.
- **Matched items can point at retired bottles** → Preserve that truth in source inventory while limiting catalog coverage to active bottles; a later quality report can expose stale matches directly.

## Aggregation Roadmap

1. Establish exact catalog and source-item coverage with this change.
2. Expand review evidence and ingest several additional review/release sources.
3. Produce source-backed bottle synthesis with citations and regeneration provenance.
4. Redesign bottle pages around critic evidence, release facts, and availability.
5. Build latest-release/review discovery surfaces from the same source items.
6. Add bottle/entity follows, alerts, and digests after the event stream is reliable.
