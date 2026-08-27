## Why

Peated currently asks one tasting record to hold both a quick reaction and a
100-point assessment. These actions have different intent: a member can log
many tastings of a Bottle, but their review should be one current opinion.

## What Changes

- **BREAKING** Replace Pass, Sip, and Savor on new tastings with five fixed
  rating bands.
- **BREAKING** Move member 100-point scores out of tastings and into one member
  review per Bottle.
- Keep external reviews separate, but include permitted native 100-point scores
  in the same Bottle score as member reviews.
- Calculate the Bottle score as a median. Hide it until at least 20 counted
  member and external scores exist.
- Apply member privacy only when an individual review is shown. Every valid
  member score still counts in Bottle summaries without public attribution.
- Keep tasting band counts separate from review scores. Never turn a band into
  a point or an external non-100 scale into a Peated score.
- Remove the unused 100-point tasting path. There are no existing member scores
  to migrate.
- Keep existing Pass/Sip/Savor and star values as historical tasting data. Do
  not convert them into bands or reviews.
- Rename the historical tasting columns so their meaning is clear, and place a
  short read-only ownership comment beside each schema field.
- Remove the Simple/Advanced profile preference. The tasting form always uses
  bands, and the review form always uses the 100-point scale.
- Replace old average and Pass/Sip/Savor summaries with median score fields and
  five-band counts on Bottles and BottleGroups.

## Capabilities

### New Capabilities

- `ratings-and-reviews`: Tasting bands, member reviews, counted external
  scores, Bottle summaries, historical data rules, and the separate tasting
  and review write paths.

### Modified Capabilities

None.

## Impact

- Tasting, user, Bottle, BottleGroup, and external review database schemas.
- Tasting and Bottle review API contracts, serializers, and write routes.
- Bottle and BottleGroup summary calculation and score sorting.
- Tasting forms, Bottle review forms, Bottle summaries, lists, profiles, and
  the public ratings explanation.
- A generated schema migration and recalculation of affected Bottle and
  BottleGroup summaries. No member score data needs to move.
- Existing advanced-ratings behavior is replaced by this change.
