## Why

The profile Library page can list saved bottles, but it becomes hard to use once a user has more than a small set of bottles. Users need fast ways to find a specific bottle and narrow their Library by brand or distillery without leaving the profile Library view.

## What Changes

- Add search support to the Library collection bottle list API.
- Add brand and distillery filters to the Library collection bottle list API.
- Add a Library filter bar with a search input, brand dropdown, and distillery dropdown.
- Preserve filters in the URL so filtered Library views are shareable and browser navigation works.
- Add responsive mobile behavior: search remains visible, secondary filters move into a compact filter control, active filters are visible, and filtered empty states can be cleared.
- Keep Library filtering scoped to bottles already saved in the viewed user's Library.

## Capabilities

### New Capabilities

### Modified Capabilities

- `profile-library`: Profile Library can be searched and filtered by brand and distillery while preserving privacy, pagination, and saved collection semantics.

## Impact

- `collections.bottles.list` oRPC input and query construction need new optional filters.
- Collection bottle list tests need coverage for search, brand filters, distillery filters, combined filters, pagination reset assumptions, and privacy boundaries.
- The profile Library page needs a responsive filter UI above the existing bottle table.
- The web query-param flow needs to pass `query`, `brand`, and `distiller` through to the Library query while preserving `user` and `collection: "library"` overrides.
