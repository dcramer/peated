## 1. Backend Contract

- [x] 1.1 Add generic activity schema/type exports compatible with the existing profile activity entry shape.
- [x] 1.2 Add a top-level `activity` oRPC router with a `list` route for `global`, `friends`, and `local` filters.
- [x] 1.3 Wire the activity router into the root server router.

## 2. Backend Composition

- [x] 2.1 Extract shared activity composition helpers from the profile activity route.
- [x] 2.2 Update the profile activity route to use the shared helper without changing its response contract.
- [x] 2.3 Implement main feed source filtering for tastings and collection additions using existing visibility semantics.
- [x] 2.4 Implement main feed collection-add grouping by actor, collection, and day bucket with preview serialization.

## 3. Backend Tests

- [x] 3.1 Add main activity route tests for mixed tasting and collection-add responses.
- [x] 3.2 Add route tests for anonymous/private visibility and authenticated global visibility.
- [x] 3.3 Add route tests for friends feed authentication and followed-user filtering.
- [x] 3.4 Add route tests for grouped collection-only activity and secondary throttling.

## 4. Web Activity UI

- [x] 4.1 Rename or generalize the profile activity list component so main and profile feeds share mixed activity rendering.
- [x] 4.2 Switch global, friends, and local activity pages to query the new activity list route.
- [x] 4.3 Update infinite scrolling in the main `ActivityFeed` component to use the mixed activity route and response type.
- [x] 4.4 Preserve the current main feed empty and error states.

## 5. Verification

- [x] 5.1 Run targeted backend activity route tests.
- [x] 5.2 Run server and web typechecks for touched packages.
- [x] 5.3 Run file-scoped lint/format for changed TypeScript files.
