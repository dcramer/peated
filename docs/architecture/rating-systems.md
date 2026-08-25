# Rating Systems Architecture

## Overview

Peated keeps three rating populations separate because they answer different
questions and follow different ownership rules.

| Population                | Storage          | Meaning                              | Aggregate                       |
| ------------------------- | ---------------- | ------------------------------------ | ------------------------------- |
| Simple community ratings  | `tasting.rating` | Pass, Sip, or Savor                  | Distribution and simple average |
| Advanced community scores | `tasting.score`  | Peated's uniform 0-100 rubric        | Arithmetic mean and score count |
| External critic reviews   | `review.rating`  | Score owned by the named publication | No Peated community aggregate   |

Historical five-star tasting data remains in `tasting.rating_legacy`. It is
preserved for provenance and does not contribute to current aggregates.

## Tasting Data Model

```typescript
rating: smallint("rating"); // -1, 1, 2, or null
score: smallint("score"); // integer 0-100 or null
ratingLegacy: doublePrecision("rating_legacy"); // historical 0-5 value
```

Database constraints enforce:

- `score` is null or an integer from 0 through 100.
- `rating` and `score` cannot both be non-null.
- A tasting may have either system or no rating.

The API exposes `rating` and `score` as separate nullable fields. Create
requests containing both values are rejected. On update, submitting a non-null
value for one system clears the other, making a system change an explicit
replacement. Clearing one value never invents a value in the other system.

There is no automatic conversion among simple, advanced, or legacy values.

## Simple Ratings

| Value | Label | Meaning                      |
| ----- | ----- | ---------------------------- |
| `-1`  | Pass  | Not my thing                 |
| `1`   | Sip   | Enjoyable; would drink again |
| `2`   | Savor | Amazing; would seek out      |

Bottle `avgRating` and `ratingStats` use only non-null simple ratings.

## Advanced Ratings

Advanced ratings are whole-number evaluations of the whisky in the glass. They
exclude price, rarity, packaging, and reputation.

| Range  | Band            |
| ------ | --------------- |
| 95-100 | Extraordinary   |
| 90-94  | Exceptional     |
| 85-89  | Very good       |
| 80-84  | Good            |
| 75-79  | Fair            |
| 0-74   | Not recommended |

The scoring method is anchored and holistic:

1. Taste before choosing a number.
2. Start at 80, which means a good, enjoyable whisky with no major problem.
3. Move the score up for clear flavors, balance, depth, texture, and a lasting
   finish. Move it down for off flavors, rough alcohol, thin texture, poor
   balance, or a weak finish.
4. Choose the exact point within the resulting band. The bottom means the
   whisky just fits, the middle means it clearly fits, and the top means it
   nearly reaches the next band.

The score is a judgment of the whisky as a whole. Peated does not require or
add together nose, palate, finish, or balance subscores.

`ADVANCED_RATING_BANDS` and `getAdvancedRatingBand()` in the server constants
are the canonical programmatic definition. Web inputs, community displays, and
permitted native 100-point critic scores use that helper rather than duplicating
thresholds.

Individual scores display as integers. Community averages display to one
decimal with the number of scores. A one-point difference communicates a
personal comparative judgment, not objective measurement.

## User Preference

`user.rating_system` stores `simple` or `advanced` and defaults to `simple`.
The preference is private account data and chooses the control for every
tasting form. Users change the system only in profile settings. Tasting forms
do not include a system selector.

When the profile setting differs from an existing tasting's rating system, the
form keeps the saved rating until the user enters a rating in the shown system.
The new rating replaces the saved rating. Peated does not convert it.

The preference affects input behavior only. It does not hide either community
aggregate from bottle pages.

## Materialized Aggregates

Both `bottle` and `bottle_group` store:

```typescript
avgScore: doublePrecision("avg_score");
totalScores: bigint("total_scores", { mode: "number" });
```

Each Bottle aggregate includes only tastings assigned to that exact marketed
release. Its BottleGroup aggregate derives from raw tastings assigned to every
active member Bottle, counted once. The group owns no direct tastings.

`totalTastings` counts all tasting records, including records with no rating.
`totalScores` counts only non-null advanced scores. `avgScore` is the arithmetic
mean of those scores and is null when the count is zero.

Tasting create, update, and delete routes persist the tasting first and then
enqueue `UpdateBottleStats`. That worker is the authoritative path: it
recomputes the exact Bottle, its current BottleGroup, and related entity stats
from current tasting rows. Dispatch failures are logged without rolling back an
already durable tasting.

## Sorting and Filtering

Bottle list API consumers can use:

- `sort=score` for ascending advanced community average.
- `sort=-score` for descending advanced community average.
- `minScore=<0-100>` to require a minimum advanced average.

Unscored bottles sort last. Simple rating sort and filter parameters continue
to use `avgRating`; no parameter silently falls back to the other system.

The initial release does not apply Bayesian ranking, outlier trimming, reviewer
weighting, or a minimum-count promotion threshold. Interfaces must show the
score count so users can judge a sparse average. A future top-rated feature
must define its own minimum-count and confidence policy.

## External Critic Reviews

External review scores remain in the `review` table and retain their source
name and URL. When source policy permits display and the publication's native
scale is 100 points, Peated may add its standard band label. The named
publication still owns its tasting methodology.

External reviews never contribute to `avgScore`, `totalScores`, `avgRating`, or
`ratingStats`. UI copy must keep “Peated Community Score,” simple community
ratings, and “The Critics” visibly distinct.

## Public Methodology and Structured Data

The static `/about/ratings` page is the public source of truth for both community
systems. Advanced inputs and community summaries link to it. OpenAPI field
descriptions state the numeric range and separation invariant.

Schema.org aggregate rating data is emitted only for advanced community scores,
with `bestRating: 100`, `worstRating: 0`, and `reviewCount: totalScores`.
Pass/Sip/Savor values must not be exposed as an unlabeled conventional numeric
aggregate.

## Migration and Rollback

The advanced schema migration is additive. Existing simple and legacy ratings
are not rewritten. New users and existing users receive the `simple` default.

Application rollback can hide the advanced inputs while leaving score columns
intact. This preserves any scores created after launch and avoids a destructive
down migration.

## Verification Expectations

Changes to ratings should cover:

- Integer and range validation, including valid score `0`.
- Database and API prevention of dual ratings.
- Replacing and clearing each system.
- Preference persistence and existing-tasting precedence.
- Exact Bottle and BottleGroup aggregate scope.
- Separation from simple, legacy, and critic data.
- Null-last score sorting and minimum-score filtering.
- Accessible input constraints, band copy, and public methodology links.
