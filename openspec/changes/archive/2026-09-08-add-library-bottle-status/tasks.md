## 1. Data Model

- [x] 1.1 Add `sealed`, `open`, and `empty` status support to the `collection_bottle` Drizzle schema as a nullable field.
- [x] 1.2 Generate the database migration with `pnpm db:generate` and verify existing rows remain unset.
- [x] 1.3 Update generated/inferred server types to include nullable collection bottle status where needed.

## 2. API

- [x] 2.1 Add a shared collection bottle status schema and expose nullable `status` on `CollectionBottleSchema`.
- [x] 2.2 Include `status` in `CollectionBottleSerializer` output.
- [x] 2.3 Extend `CollectionBottleInputSchema` and `collections.bottles.create` to accept optional nullable status for Library entries.
- [x] 2.4 Add an entry update route for collection bottles that can set or clear Library entry status and returns the updated entry.
- [x] 2.5 Add status filtering to `collections.bottles.list` for Library entries, including an unset filter.
- [x] 2.6 Wire the new update route into `collections.bottles.index`.

## 3. Web Library UI

- [x] 3.1 Add reusable status label/chip metadata for `sealed`, `open`, and `empty`.
- [x] 3.2 Show editable inline status chips for the signed-in user's Library rows and passive status labels for other users' Library rows.
- [x] 3.3 Add status mutation handling, cache updates, and query invalidation to Library entry actions.
- [x] 3.4 Add `Clear Status` to the Library row overflow menu.
- [x] 3.5 Add a Library status filter with `Any`, `Sealed`, `Open`, `Empty`, and `Not set` options.
- [x] 3.6 Add optional quick status chips to add-to-Library confirmation flows.

## 4. Verification

- [x] 4.1 Add backend tests for create, serialize, update, authorization, clear status, and list filtering behavior.
- [x] 4.2 Add frontend tests or focused component coverage for Library status display, inline updates, and filters where existing test patterns support it.
- [x] 4.3 Run targeted backend tests for collection bottle routes.
- [x] 4.4 Run targeted frontend lint/typecheck for touched Library UI files.
