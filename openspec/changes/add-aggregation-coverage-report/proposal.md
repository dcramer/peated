## Why

Peated cannot currently measure how much of its active bottle catalog is supported by scraped reviews, prices, images, and descriptions. A small, exact coverage report is needed before choosing new sources or redesigning bottle pages so that aggregation work can be prioritized from evidence instead of intuition.

## What Changes

- Add an admin-only API report for active bottle catalog coverage.
- Report exact counts for active bottles with descriptions, images, visible external reviews, and visible store prices.
- Report visible review and price item totals split into matched and unmatched items.
- Keep the report read-only and compute it from existing catalog and source tables; no new persistence, scheduled jobs, or UI are introduced in this slice.
- Define the broader aggregation roadmap while leaving richer source evidence, grounded synthesis, bottle-page presentation, feeds, and alerts to later changes.

## Capabilities

### New Capabilities

- `catalog-coverage`: Admins can retrieve an exact snapshot of catalog content coverage and scraped-item matching coverage.

### Modified Capabilities

None.

## Impact

- Adds one admin oRPC route and response contract under `apps/server`.
- Reads existing bottle, tombstone, review, and store-price tables without changing their schemas.
- Adds integration coverage for authorization, active-bottle filtering, hidden source records, and matched versus unmatched totals.
- Does not change the public `/stats` response or add frontend behavior.
