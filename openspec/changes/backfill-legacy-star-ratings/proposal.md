## Why

Old five-star tasting ratings are preserved but excluded from current rating
displays, totals, profiles, and recommendations. The retained
quarter-star values and their earlier Pass/Sip/Savor conversion provide enough
information to place them in the current five tasting ratings without changing
newer member choices.

## What Changes

- Convert historical star ratings into the current Mediocre, Good, Very good,
  Outstanding, and Unicorn tasting ratings with one fixed mapping.
- Convert only tastings that retain a star rating and do not already have a
  current rating.
- Keep the original star and Pass/Sip/Savor values on the record.
- Let administrators preview the exact number before converting anything.
- Add a Maintenance page where administrators can preview and start this
  one-off repair.
- Rebuild affected Bottle and BottleGroup rating totals after the conversion.
- Update public and internal rating documentation to describe the historical
  conversion.

## Capabilities

### New Capabilities

- `legacy-star-rating-backfill`: Old star conversion, write protection, preview
  counts, and rating-total rebuilding.

### Modified Capabilities

None.

## Impact

- Historical tasting rows and their stored `rating_band` values.
- Bottle and BottleGroup tasting-rating totals.
- Profile rating totals, flavor summaries, activity displays, tasting pages,
  and Bottle recommendations that already read current tasting ratings.
- A protected administrator API, a simple Admin Maintenance page, the rating
  architecture guide, and the public rating guide.
- No schema or public API changes; the new operations are internal.
