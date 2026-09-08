## Why

Catalog search can turn incomplete tokens, stale indexes, or backend failures into false “not found” results. Because manual search can lead directly to Bottle creation, these false negatives can create duplicate catalog records.

## What Changes

- Make Bottle and Entity typeahead search match complete and partial words without enabling user-supplied search operators.
- Make global search report failures instead of silently treating failed result sources as empty.
- Blend result types deterministically so one source does not consume the full global limit.
- Give new Bottles an initial search vector and refresh Bottle vectors when related Entity names change.
- Stabilize ranked pagination and align Library alias filtering with catalog search.
- Add focused integration tests for recall, ranking, failure, and freshness contracts.

## Capabilities

### New Capabilities

- `catalog-search`: Human catalog retrieval, global result blending, index freshness, and failure behavior.

### Modified Capabilities

None.

## Impact

This change affects the shared PostgreSQL text-search helpers, Bottle and Entity list routes, the global search route, Bottle indexing dispatch, Library search, and their deterministic tests. It adds no external service or semantic-search dependency.
