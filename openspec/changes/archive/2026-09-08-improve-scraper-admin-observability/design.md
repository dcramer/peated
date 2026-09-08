## Context

The external-site admin already owns the operator workflow: it lists sites,
shows a latest run, supports manual runs, and exposes price, review, and run
tabs. The scraper runtime now persists substantially more factual state than
these pages expose, including request/retry/rate-limit counters, target
enablement and cooldowns, robots cache state, and review content policy. A
separate dashboard would duplicate navigation and lifecycle concepts.

## Goals / Non-Goals

**Goals:**

- Make the existing admin surface sufficient to determine whether a scraper ran, behaved responsibly, and produced useful matched data.
- Reuse existing durable state and the existing catalog coverage API.
- Keep scraper registration and traffic controls inside the scraper module while exposing a narrow read-only registration summary.
- Represent missing, disabled, blocked, and unknown states factually instead of inventing an opaque health score.

**Non-Goals:**

- Editing traffic limits, targets, origins, robots decisions, or review permissions from this UI.
- Adding time-series infrastructure, alerts, or a general monitoring service.
- Persisting new telemetry or changing scraper execution behavior.
- Measuring new/updated/unchanged persistence outcomes, which are not currently recorded.

## Decisions

### Extend the existing external-site health contract

Replace the price-only `listingCount` with separate review and price coverage objects containing total, matched, and unmatched counts. This uses the same visible-item semantics as the existing catalog coverage report and prevents review-only sources from appearing empty.

The health contract will also expose a read-only runtime summary: whether the source is registered, its synchronized targets and origins, target enablement/cooldown state, derived robots cache status, and the applicable policy for review sources.

Alternative: add several new admin endpoints. That creates coordination and loading complexity without a distinct ownership boundary; this data is all part of one source's operational health.

### Keep code-owned registration behind the scraper boundary

The scraper module will export a narrow registration lookup containing only target keys. API routes will not import the production registry or adapters directly. The existing review-source type boundary determines policy applicability, and synchronized SQL remains authoritative for mutable target/origin state.

Alternative: infer review-source status from adapter details or hard-code
Whisky Advocate. Both approaches can drift as sources are added.

### Expose existing run counters directly

Recent-run serialization will add request budget, lifetime request/retry/rate-limit/emitted-item counts, current-slice count, and next attempt time. The UI will show these values without deriving success rates from a single run.

### Reuse the existing catalog coverage report

The scraper list page will query the existing administrator-only catalog coverage endpoint and render a compact coverage summary. Source-specific inventory remains on each source row/detail; global Bottle coverage remains a separate aggregate rather than being recomputed in the external-sites route.

### Change the label, not the route

The admin navigation and breadcrumbs will say “Scrapers,” while existing `/admin/sites` URLs remain stable. The underlying domain model continues to use `externalSite` because a site/source is durable identity and a scraper run is an execution.

## Risks / Trade-offs

- **Additional health queries could make an admin page slower** → Load the paginated source set with a fixed number of grouped queries keyed by site id; the detail endpoint reuses the same loader for one source.
- **Robots cache state can be mistaken for a full policy audit** → Label it as cached robots state and show timestamps; review permission remains a separate explicit policy.
- **A registered source can temporarily lack synchronized SQL definitions during deploy** → Show registration and synchronized targets separately so the mismatch is visible instead of silently treating it as healthy.
- **No historical trend or persistence disposition is available** → Show recent runs and exact counters only; add new telemetry later only if operators demonstrate a need.
