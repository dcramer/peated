# Rating Systems Architecture

## Overview

Peated uses the Pass/Sip/Savor rating system for current tastings. Historical
five-star values remain in `tasting.ratingLegacy`; `tasting.rating` stores the
current simple value.

Rating identity follows the
[Whisky Identity Model](./whisky-identity-model.md): every tasting references
one independently complete Bottle. BottleGroup is an aggregate scope, never a
tasting target.

## Values

| Value  | Label     | Meaning                         |
| ------ | --------- | ------------------------------- |
| `-1`   | Pass      | Would not drink again           |
| `1`    | Sip       | Enjoyable; would have sometimes |
| `2`    | Savor     | Excellent; would seek out       |
| `null` | No rating | Tasting recorded without rating |

The database stores the value as a `smallint`. API schemas accept only `-1`,
`1`, `2`, or `null`.

## Identity And Persistence

- `tasting.bottleId` is the authoritative, non-null catalog identity.
- Live tasting inputs and outputs use Bottle identity only.
- BottleGroup ids and representative Bottles are never substitutes for an
  unknown Bottle.
- `tasting.releaseId` remains temporarily as historical migration evidence.
  Live reads, writes, and aggregate calculations do not use it.
- No generic tasting or direct BottleGroup activity exists.

Legacy parent-only tastings remain on the retained general Bottle during the
catalog migration. Release-specific tastings move to the independently complete
Bottle recorded by the durable release-promotion mapping.

## Stored Aggregates

Bottle and BottleGroup rows store the same derived fields:

```ts
type RatingStats = {
  pass: number;
  sip: number;
  savor: number;
  total: number;
  avg: number | null;
  percentage: {
    pass: number;
    sip: number;
    savor: number;
  };
};
```

- `totalTastings` counts rated and unrated tastings.
- `ratingStats.total`, category counts, percentages, and `avgRating` use rated
  tastings only.
- An empty aggregate has zero counts and percentages and a null average.

These database fields are the canonical materialized aggregates. Do not add an
independently computed cache or sum stored Bottle totals to produce a group
total.

## Recalculation

One shared calculator queries raw tasting rows by validated Bottle ids.

### Bottle

`recomputeBottleStats(bottleId)`:

1. rejects missing, retired, unmigrated, or invalid graph state;
2. selects raw tastings whose `bottleId` is exactly the requested Bottle;
3. overwrites that Bottle's stored aggregate fields.

Sibling Bottles and group totals do not contribute.

### BottleGroup

`recomputeBottleGroupStats(groupId)`:

1. rejects missing or retired groups;
2. loads the group's active, non-retired member Bottle ids;
3. queries raw tastings across those Bottle ids once;
4. overwrites the group's aggregate fields and active `totalBottles`.

The calculation does not read direct group activity, select a representative,
or add already materialized Bottle totals.

## Write And Worker Flow

Tasting creation and deletion queue `UpdateBottleStats` after the database
mutation commits. A rating-changing update does the same. Queue publication
failure is logged without rolling back the committed tasting.

`UpdateBottleStats` carries only `bottleId` and recomputes:

1. the Bottle;
2. its current BottleGroup;
3. Bottle-owned entity statistics.

There is no separate group-stats queue path. Transactions that change group
membership recompute affected groups before commit; ordinary tasting activity
converges through the idempotent Bottle job.

## Legacy Rating Migration

The simple-rating migration preserved the previous five-star value in
`ratingLegacy` and converted the active rating:

- `rating <= 2.0` became Pass;
- `2.0 < rating <= 4.0` became Sip;
- `rating > 4.0` became Savor.

New writes do not maintain a second five-star rating system.

## Performance

- Keep the `tasting.bottleId` index for direct Bottle and member-set scans.
- Add rated-value indexes only when query evidence justifies them.
- Keep recomputation idempotent so delayed or retried jobs converge on raw
  activity.
- Read replicas may serve analytics but must not own alternate aggregate logic.

## Required Tests

Database-backed tests should prove:

- a Bottle aggregate includes only its direct tastings;
- a group aggregate includes raw activity for each active member once;
- unrelated and retired-member activity is excluded;
- unrated tastings affect `totalTastings` but not rated statistics;
- invalid Bottle/group graph state does not partially update aggregates;
- workers carry direct Bottle or aggregate-owner group ids; and
- rerunning recomputation produces the same derived result.
