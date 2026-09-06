## 1. Saved summary model

- [x] 1.1 Add accurately named Bottle, BottleGroup, and Entity combined count fields and a per-Bottle note-category summary table
- [x] 1.2 Generate and review the additive database migration
- [x] 1.3 Add a canonical typed public review-and-tasting source query with explicit note visibility

## 2. Summary recomputation

- [x] 2.1 Recompute combined counts, Bottle tags, and note categories atomically with Bottle rating stats
- [x] 2.2 Derive BottleGroup and Entity combined counts from active Bottle summaries
- [x] 2.3 Remove tasting-only manual Bottle-tag maintenance and keep merge/delete behavior consistent
- [x] 2.4 Queue bounded Bottle recomputes after member privacy and tag taxonomy changes

## 3. Summary-backed reads

- [x] 3.1 Move Bottle, Entity, and region flavor profiles to saved tag/category summaries
- [x] 3.2 Move Bottle tags and suggestions to saved Bottle-tag summaries
- [x] 3.3 Move tag/category Bottle ranking and Bottle tag filtering to saved summaries
- [x] 3.4 Move public Bottle and Entity counts, catalog columns, and popularity sorting to combined saved counts

## 4. Combined public lists

- [x] 4.1 Add one viewer-aware, stably paginated reviews-and-tastings API for Bottle and Entity scopes
- [x] 4.2 Use the combined API on Bottle overview and Bottle/Entity list pages
- [x] 4.3 Relabel combined public tabs, headings, empty states, and sort controls while preserving profile wording and route compatibility

## 5. Verification and documentation

- [x] 5.1 Add source, privacy, publication, duplicate-category, recompute, filtering, sorting, and pagination tests
- [x] 5.2 Update ratings, Bottle presentation, and external-review documentation with the final summary and list rules
- [x] 5.3 Run focused tests, server and web typechecks, lint, formatting, migration checks, and production-like query-plan checks where available
