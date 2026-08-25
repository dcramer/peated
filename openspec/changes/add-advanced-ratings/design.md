## Context

Peated currently stores a simple tasting rating in `tasting.rating` using `-1` (Pass), `1` (Sip), or `2` (Savor), preserves historical five-star values in `rating_legacy`, and materializes simple aggregates on exact Bottles and their BottleGroups. External publication reviews use separate normalized and native score fields. The web application has no persisted rating-system preference, no community 100-point input, and no public methodology page.

The change crosses persistence, public API contracts, aggregate maintenance, account settings, tasting forms, exact-Bottle and release-family displays, and documentation. Exact releases matter to advanced reviewers, so a BottleGroup-only aggregate would be insufficient.

## Goals / Non-Goals

**Goals:**

- Give any user an optional, precise 0-100 integer score using a uniform Peated rubric.
- Preserve Pass/Sip/Savor as the default and keep every rating population independently understandable.
- Make the selected default rating system follow a signed-in user across devices.
- Maintain accurate arithmetic-mean score aggregates for both exact Bottles and their BottleGroups.
- Explain the scoring bands and evaluation principles consistently in the form, public site, API, and internal docs.

**Non-Goals:**

- Converting existing simple or legacy five-star ratings into 100-point scores.
- Combining simple ratings, community scores, or external critic scores into one aggregate.
- Requiring nose, palate, finish, or balance subscores.
- Adjusting scores for price, rarity, packaging, or reputation.
- Adding Bayesian ranking, outlier trimming, reviewer weighting, or critic-score normalization in the first version.

## Decisions

### Store an independent score on each tasting

Add nullable `score` to `tasting` with database constraints requiring an integer from 0 through 100 and preventing `rating` and `score` from both being non-null. Keep `rating_legacy` untouched. Separate columns make the invariant visible, avoid overloaded numeric meanings, and preserve backwards compatibility for existing simple-rating consumers.

The public tasting API exposes nullable `rating` and nullable `score`. Create requests containing both non-null values are rejected. On update, submitting a non-null value for one system explicitly clears the other so changing systems is a deliberate replacement. Sending null clears only the named value.

Alternative considered: a polymorphic JSON rating object. This would make the discriminator explicit but would complicate filtering, aggregation, database constraints, and compatibility for little benefit with two stable systems.

### Persist a default system on the user

Add `ratingSystem` with values `simple` and `advanced`, defaulting to `simple`. It is private account data exposed when the serialized user is the current user or visible to a moderator under existing serializer rules. New tasting forms initialize from the preference. Existing tastings initialize from whichever stored rating is present, so changing the preference never changes old data.

The tasting form includes an explicit Simple/100-point control. Choosing a different control clears the unsaved value from the other system. This preference controls input behavior, not which aggregate other people see.

Alternative considered: local storage. A server-side preference is consistent across devices and available during authenticated data loading.

### Define one Peated score rubric

Peated uses whole-number scores and these bands everywhere it interprets a 100-point value:

- 95-100: Extraordinary
- 90-94: Exceptional
- 85-89: Very good
- 80-84: Good
- 75-79: Fair
- 0-74: Not recommended

The score evaluates the whisky in the glass and the user's experience of it, excluding price, rarity, packaging, and reputation. A one-point difference is personal comparative precision, not objective measurement. Community aggregate scores display one decimal and a score count.

The same band labels and visual helper can categorize a permitted native critic score when its source scale is 100 points. External reviews remain source-attributed, and Peated never exposes a normalized compatibility value as though it were the publication's methodology.

Alternative considered: adopting one publisher's terminology verbatim. A Peated-owned rubric avoids implying that a third party controls community scoring while remaining compatible with familiar whisky conventions.

### Materialize exact-Bottle and BottleGroup aggregates

Add `avgScore` and `totalScores` to both Bottles and BottleGroups. `avgRating` and `ratingStats` continue to use only simple ratings. The existing `UpdateBottleStats` job remains the authoritative recomputation path: it aggregates direct activity for one exact Bottle and raw activity across active members for that Bottle's group.

Create, update, and delete routes persist the authoritative tasting and enqueue recomputation after commit, following the repository's background-work policy. Sorting and filtering use exact-Bottle `avgScore` values and exclude null aggregates. `totalTastings` remains the count of all tasting records, with or without either rating.

Alternative considered: calculating every aggregate at read time. Materialized fields match the existing architecture and avoid repeated aggregation on high-traffic bottle pages.

### Keep the three user-facing populations visibly separate

Tasting entries display either Pass/Sip/Savor or an integer score. Exact-Bottle and release-family pages label advanced aggregates as community scores and retain simple distribution language. External reviews remain under “The Critics” with their publication names. No fallback, conversion, or blended “primary rating” hides which population produced a value.

### Make methodology a product surface

Add a static public `/ratings` page covering both systems, the advanced bands, what is and is not evaluated, aggregation, and the distinction from critic reviews. The advanced input shows compact band guidance and links to this page. OpenAPI descriptions state ranges, exclusivity, and aggregate meaning. Internal rating docs are rewritten to match the implemented model rather than retaining speculative migration examples.

## Risks / Trade-offs

- **Sparse advanced ratings can produce volatile averages** → Always display the count; do not promote a score as a ranking signal without a later explicit minimum-count policy.
- **Users may treat one-point differences as objective precision** → Public and inline guidance describe scores as personal comparative judgments.
- **Two rating controls can add form complexity** → Keep simple as the default and show only the selected input.
- **Changing systems while editing can accidentally discard a value** → Existing data determines the initial control, and the switch is explicit before save.
- **External critic bands are not perfectly uniform** → Apply labels only to permitted native 100-point scores, preserve source attribution, and describe the label as Peated's display interpretation.
- **Materialized aggregates can drift** → Retain deterministic exact-Bottle and BottleGroup recomputation from raw tasting rows.

## Migration Plan

1. Generate a Drizzle migration adding nullable score columns, aggregate fields, the user preference, defaults, and constraints.
2. Deploy additive schema and API changes; existing clients continue using `rating` unchanged.
3. Recompute Bottle and BottleGroup aggregates. Existing score totals remain zero because no scores predate the feature.
4. Deploy settings, form, display, filter/sort, and methodology surfaces.
5. Roll back application behavior by hiding advanced inputs while leaving additive columns intact; no existing simple or legacy data needs conversion.

## Open Questions

- A minimum score count for future “top rated” rankings is intentionally deferred; the initial release exposes averages and counts without claiming ranking confidence.
