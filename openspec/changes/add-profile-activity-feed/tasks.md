## 1. Backend Activity Contract

- [x] 1.1 Add profile activity entry schemas for `tasting` and `collection_add` discriminated union responses.
- [x] 1.2 Add collection-add summary serialization that includes destination collection, preview collection bottle items, total item count, and activity timestamps.
- [x] 1.3 Add an oRPC profile activity list route under the user/profile route surface with target user resolution and existing profile visibility checks.
- [x] 1.4 Wire the new route into the server router with a stable operation id and generated client types.

## 2. Backend Feed Composition

- [x] 2.1 Query recent user tastings as primary activity source rows ordered by creation time.
- [x] 2.2 Query recent `collection_bottle` rows joined to `collection`, bottle, and release records as secondary activity source rows ordered by creation time.
- [x] 2.3 Group collection-add source rows by user, collection, and bounded time window while excluding duplicate add attempts that did not create rows.
- [x] 2.4 Compose primary and secondary rows into one paginated profile feed with secondary entries capped so they do not overwhelm primary tasting entries.
- [x] 2.5 Return collection links for reserved Favorites and Library destinations and item links through serialized bottle/release data.

## 3. Backend Tests

- [x] 3.1 Add route tests proving tasting activity appears as primary profile activity.
- [x] 3.2 Add route tests proving multiple additions to the same collection are grouped into one secondary entry with preview items and total count.
- [x] 3.3 Add route tests proving additions to different collections produce separate secondary entries.
- [x] 3.4 Add route tests proving secondary entries are capped when a profile also has primary tasting activity.
- [x] 3.5 Add route tests proving collection-add entries fill an otherwise empty visible profile.
- [x] 3.6 Add route tests proving private profile visibility behavior matches existing profile routes.

## 4. Web Profile Activity UI

- [x] 4.1 Add a polymorphic profile activity list component that dispatches by activity entry type.
- [x] 4.2 Reuse existing tasting list item rendering for `tasting` activity entries.
- [x] 4.3 Add a compact collection-add activity item with destination collection link, preview item links, and `+N more` count.
- [x] 4.4 Replace the profile Activity tab query from `tastings.list({ user })` to the new profile activity feed.
- [x] 4.5 Preserve existing profile stats, badge list, and charts below the activity list.
- [x] 4.6 Keep the empty state correct when a profile has neither tasting nor collection-add activity.

## 5. Verification

- [x] 5.1 Run targeted backend profile activity route tests.
- [x] 5.2 Run targeted web lint/typecheck for changed profile activity files.
- [x] 5.3 Manually verify a profile with tastings and collection additions renders a mixed feed at desktop and mobile widths.
- [x] 5.4 Manually verify a profile with only collection additions shows grouped secondary activity instead of an empty activity state.
