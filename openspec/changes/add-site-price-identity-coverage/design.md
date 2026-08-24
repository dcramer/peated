## Context

StorePrice rows already hold the current exact Bottle assignment, external product id, source fingerprint, visibility, and owning external site. The API already supports listing unresolved prices by site, but it does not expose per-site identity coverage counts.

## Goals / Non-Goals

**Goals:**

- Let an administrator query current identity coverage for one external site.
- Keep the response small, stable, and directly derived from StorePrice state.
- Reuse existing authentication, site identifiers, and price-list drill-down.

**Non-Goals:**

- No global rollup, percentages, samples, history, event tracking, persistence, background job, or UI.
- No classifier or matching behavior changes.

## Decisions

Add `GET /external-sites/{site}/prices/identity-coverage` beside the existing external-site price ingestion route. The route requires administrator access and returns `total`, `matched`, `unmatched`, `withSourceId`, and `withFingerprint`.

Resolve `{site}` through the existing external-site type and database row. Return not found when the configured site does not exist. Count only visible StorePrice rows owned by that site in one aggregate query. `matched` means `bottleId` is non-null; `unmatched` means it is null. Source coverage uses non-null `externalProductId` and `sourceFingerprint`.

Keep row inspection on `GET /prices` with its existing `site` and `onlyUnknown` filters. This avoids duplicating pagination and serialization.

## Risks / Trade-offs

- Current-state counts do not explain historical reuse or invalidation events. This is intentional; event storage can be justified separately if current coverage proves insufficient.
- Old rows can lack fingerprints until they are ingested again. The endpoint reports that gap rather than inferring coverage.
