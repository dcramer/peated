## 1. Backend Reserved Collections

- [x] 1.1 Add shared reserved collection constants/types for `default` as Favorites and `library` as Library, including a code comment that `default` is the historical API token for Favorites.
- [x] 1.2 Replace ad hoc default collection lookup with a name-based reserved collection resolver that supports lookup-only, create-on-write, and no-op delete behavior for missing reserved collections.
- [x] 1.3 Update collection bottle create, delete, and list route schemas to accept both reserved aliases plus numeric collection IDs.
- [x] 1.4 Update collection bottle create, delete, and list handlers to use the shared resolver while preserving ownership checks for custom collection IDs.
- [x] 1.5 Update bottle favorite serialization to use the shared Favorites backing name instead of an inline `default` string.

## 2. Backend Tests

- [x] 2.1 Add route tests that create, list, and delete bottles in the `library` reserved collection.
- [x] 2.2 Add tests proving `default` Favorites and `library` Library entries are independent when the same bottle appears in one or both.
- [x] 2.3 Add tests that Library rejects writes to another user's collection and respects existing profile visibility on reads.
- [x] 2.4 Add regression coverage for reserved collection lookup when a user has both `Default` and `Library` rows.

## 3. Web Save Actions

- [x] 3.1 Refactor the existing collection action so Favorites and Library can share mutation/query plumbing without losing distinct labels, icons, and active states.
- [x] 3.2 Keep the Favorites action using the star icon and `default` alias.
- [x] 3.3 Add a Library action using a distinct icon, such as `BookmarkIcon`, and the `library` alias.
- [x] 3.4 Render both actions on bottle and release save surfaces that currently expose Favorites, including unauthenticated login redirects.

## 4. Profile Library UI

- [x] 4.1 Update the profile Favorites page to load Favorites through `collections.bottles.list` with collection alias `default`.
- [x] 4.2 Add a profile Library tab and route at `/users/[username]/library`.
- [x] 4.3 Render Library bottles with the existing bottle table, pagination, and an empty state for users with no Library entries.
- [x] 4.4 Ensure private profile handling continues to block both Favorites and Library through the existing profile layout/route behavior.

## 5. Verification

- [x] 5.1 Run targeted backend collection route tests.
- [x] 5.2 Run relevant web checks for the changed profile/action files.
- [x] 5.3 Run `pnpm test` before finalizing the implementation.
- [x] 5.4 Add and run e2e coverage for saving a bottle to Library and viewing it on the profile Library route without adding it to Favorites.
