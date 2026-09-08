## Context

Issue #1006 asks for user-visible source ratings and reviewed conversions. The pilot found that Words of Whisky explicitly divides its 100-point scale by ten, while Dramface uses a different rubric.

## Goals / Non-Goals

Provide site-level settings, previews, safe dated rules, and one shared calculation. Keep original records and current median/visibility rules. Do not automatically activate research mappings or change reviewer weights.

## Decisions

- Store validated scoring settings in the existing external-site config table under a reserved key. Use the site row lock and expected version to reject stale edits. Generic config writes cannot edit this key.
- Each rule contains a native scale, guide URL, explanation, ordered score points, and optional publication-date bounds. Reject overlapping rules on the same scale. Date-bounded rules exclude undated reviews. These explicit periods preserve old publisher rubrics.
- Interpolate between points and round once, half up. Excluded sources and unsupported scores yield null. Absent settings retain the existing native whole-number 100-point rule for rollout compatibility; the settings UI makes that default explicit.
- Derive scores from native values during summary recomputation instead of storing a second score per review. Batch-load settings by stored site IDs. The same calculation serves previews, serializers, and maintenance counts.
- Preview samples plus before/after complete Bottle summaries for a bounded set of affected Bottles. Save queues a durable site recomputation job that reads current settings and retries safely.
- Public APIs expose each review's contribution separately from its original score. Shared critic display shows original scale and contribution; the feed and sidebar show native scores compactly.

## Risks / Trade-offs

- Editorial estimates are not calibration: record evidence and show them as Peated estimates.
- Missing historical dates cannot prove a rubric applies: exclude them from dated rules.
- Default native 100-point behavior is retained until a moderator replaces it; no new conversion is enabled by deployment.
- Derivation reads individual review values: retain SQL for member/tasting aggregation and batch-load source settings.

## Migration Plan

No database migration is needed. Deploy the settings and calculation together, preview each site, then save reviewed rules. Returning a site to explicit exclusion removes its contributions on recomputation. Native reviews remain unchanged.
