## Context

Library is implemented as a reserved saved collection alias backed by the generic collection tables. The profile Library tab currently calls `collections.bottles.list` with `collection: "library"` and renders results through the shared `BottleTable`.

The general bottle list endpoint already supports text search, brand filtering, and distillery filtering. The Library page cannot use that endpoint directly because the Library view must remain scoped to a specific user's saved collection, keep collection-bottle metadata such as Library entry images, and continue using collection privacy rules.

## Goals / Non-Goals

**Goals:**

- Let viewers search a visible profile's Library by bottle text.
- Let viewers filter a visible profile's Library by brand and distillery.
- Keep filtering server-side so pagination and result counts are based on the filtered collection.
- Keep filters encoded in URL query params.
- Provide a mobile layout that keeps search visible and makes secondary filters usable without horizontal overflow.
- Reuse existing collection visibility, serializers, and bottle search/filter semantics where practical.

**Non-Goals:**

- Add arbitrary user-defined collection browsing or management.
- Add inventory fields, purchase metadata, bottle counts by filter, or cellar management.
- Add a new persistence table or denormalized search index.
- Change Favorites behavior unless shared collection list plumbing needs the same input schema.
- Build facet-only dropdown option endpoints in the first implementation.

## Decisions

### Extend collection bottle listing instead of composing with bottle search

Add optional `query`, `brand`, and `distiller` inputs to `collections.bottles.list`. Apply them inside the existing collection-scoped query.

This keeps the route responsible for profile visibility, reserved collection lookup, collection bottle image serialization, release-aware rows, and pagination. Using `bottles.list` first and then intersecting results with Library entries would make pagination incorrect and would lose collection-bottle row data.

Alternative considered: add a general `collection` filter to `bottles.list`. That could be useful later, but it mixes saved-collection visibility into the global catalog search endpoint and does not return collection-bottle metadata.

### Reuse bottle search semantics

Use the same text-search behavior as the general bottle list where feasible: search the bottle search vector and include exact bottle alias matches. Brand filtering should match `bottles.brandId`; distillery filtering should use `bottlesToDistillers`.

This avoids making Library search feel different from catalog search. If alias matching adds too much query complexity, the implementation can ship with the search vector first, but tests should lock whichever behavior is chosen.

Alternative considered: client-side filtering of the current page. That would be misleading because it only filters the current page of results and breaks pagination.

### Use global async entity selectors first

The brand and distillery dropdowns should use existing entity search patterns rather than a custom static list. The first implementation can search global entities and allow zero-result selections.

Facet-only dropdowns limited to brands or distilleries present in the viewed Library would be better for large libraries, but they require a new metadata endpoint or a new response envelope. Keep that as a later enhancement unless product needs it immediately.

Alternative considered: add `facets` to `collections.bottles.list`. That couples list results and filter metadata and may not fit the current list response shape.

### Responsive filter layout

Desktop should show search, brand, distillery, and clear filters as one horizontal control group above the table.

Mobile should keep the search input visible above the results and show brand/distillery as compact entity-filter controls directly below it. Selected brand and distillery values should live in those controls, while submitted search text can use a removable chip because the input itself can change independently. Filter changes should reset `cursor` so users do not land on an empty later page after narrowing results.

Alternative considered: move brand/distillery into a filter button that opens a bottom sheet or modal. That reduces first-viewport control height, but it made this table-filter interaction feel disconnected and hid two expected refinements behind an extra step.

## Risks / Trade-offs

- Search and distillery filters may add query cost on large collections -> keep conditions collection-scoped and use existing indexed bottle fields where available.
- Global entity dropdowns can select filters absent from the user's Library -> provide a clear filtered empty state and consider facet metadata later.
- URL-driven filters can conflict with pagination -> remove or reset `cursor` when filters change.
- Compact mobile controls can duplicate selected state if chips repeat entity values -> keep selected brand/distillery values in their controls and reserve chips for submitted text search.
- Release rows inherit bottle brand/distillery filters -> document and test that filters operate on the parent bottle for both base bottle and release Library entries.

## Migration Plan

No database migration is required. Add optional API inputs in a backward-compatible way. Existing Library URLs without filters continue to render the same unfiltered paginated list. Rollback can remove the UI and ignore the new optional API inputs without changing stored data.

## Open Questions

- Should exact alias matching be required for Library search parity with catalog search, or is bottle search-vector matching enough for the first version?
- Should brand and distillery dropdowns use global entity search initially, or should this change include Library-scoped facet options before implementation?
