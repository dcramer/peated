## Why

Peated stores tastings, member reviews, and critic reviews separately, but many
public Bottle and catalog surfaces still read only tastings. This makes ratings,
tasting notes, counts, sorting, and activity lists disagree about which public
opinions belong to a Bottle.

## What Changes

- Define one public review-and-tasting participation policy across all three
  source records while preserving their separate storage and permissions.
- Persist per-Bottle public review-and-tasting counts, tag counts, and flavor
  category counts through the existing Bottle summary worker.
- Use the saved summaries for public flavor charts, tag suggestions, tag
  filters, tag rankings, catalog counts, and popularity sorting.
- Provide combined chronological review-and-tasting lists for public Bottle,
  Entity, and global surfaces.
- Use accurate review-and-tasting names in public APIs and UI while preserving
  compatibility for existing routes during migration.
- Keep user profiles and behavior whose rules specifically require tastings or
  one review source source-specific.

## Capabilities

### New Capabilities

- `public-review-and-tasting-aggregation`: Defines shared source participation,
  visibility, saved summaries, combined public lists, and source-specific
  exceptions.

### Modified Capabilities

- `entity-identity`: Entity presentation and catalog ordering use combined
  public review-and-tasting activity instead of tasting-only totals.

## Impact

- Database schema and generated migrations for Bottle, BottleGroup, Entity, tag,
  and flavor-category summaries.
- Bottle and Entity summary workers, repair operations, merge handling, and
  invalidation after privacy or publication changes.
- Public Bottle, Entity, tag, catalog, and activity API routes and serializers.
- Public web labels, tabs, lists, filters, and sort controls.
- Integration tests for all three record sources and their visibility rules.
