## 1. Backend Filtering

- [x] 1.1 Add optional `query`, `brand`, and `distiller` inputs to `collections.bottles.list`.
- [x] 1.2 Apply text search inside the collection-scoped bottle query using the existing bottle search semantics where practical.
- [x] 1.3 Apply brand filtering through `bottles.brandId`.
- [x] 1.4 Apply distillery filtering through `bottlesToDistillers`.
- [x] 1.5 Preserve existing collection alias resolution, profile visibility checks, release rows, ordering, and pagination behavior.

## 2. Backend Tests

- [x] 2.1 Add collection bottle list tests for Library text search.
- [x] 2.2 Add tests for Library brand filtering.
- [x] 2.3 Add tests for Library distillery filtering.
- [x] 2.4 Add tests for combined Library filters.
- [x] 2.5 Add regression coverage that matching catalog bottles outside the viewed user's Library are excluded.
- [x] 2.6 Add or preserve coverage that private Library filtering remains blocked by profile visibility.

## 3. Web Filter UI

- [x] 3.1 Add a Library filter bar above the profile Library bottle table.
- [x] 3.2 Wire the search input to the `query` URL parameter and Library query input.
- [x] 3.3 Wire the brand dropdown to the `brand` URL parameter and Library query input.
- [x] 3.4 Wire the distillery dropdown to the `distiller` URL parameter and Library query input.
- [x] 3.5 Add clear-filter behavior that removes `query`, `brand`, `distiller`, and `cursor`.
- [x] 3.6 Show the unfiltered empty state only when no filters are active.
- [x] 3.7 Show a filtered empty state with a clear action when active filters return no Library entries.

## 4. Responsive Behavior

- [x] 4.1 Implement a desktop layout that shows search, brand, distillery, and clear controls in one filter row.
- [x] 4.2 Implement a mobile layout that keeps search visible and shows brand/distillery as compact controls without horizontal overflow.
- [x] 4.3 Display active mobile filters through removable search chips or equivalent compact controls.
- [x] 4.4 Ensure filter changes reset pagination before fetching the next Library result set.
- [x] 4.5 Verify the Library table and filter controls do not overflow or overlap on mobile widths.

## 5. Verification

- [x] 5.1 Run `pnpm --filter @peated/server test -- src/orpc/routes/collections/bottles/list.test.ts`.
- [x] 5.2 Run `pnpm --filter @peated/web typecheck`.
- [x] 5.3 Run targeted lint/format checks for touched files.
- [x] 5.4 Manually verify desktop Library filtering with local UI.
- [x] 5.5 Manually verify mobile Library filtering, active filters, and filtered empty state with local UI.
