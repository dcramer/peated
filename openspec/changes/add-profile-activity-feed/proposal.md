## Why

User profiles currently show only tasting activity, so adding bottles to Library or Favorites is invisible even though those actions are meaningful profile signals. Collection-add activity should appear in the profile feed, but as low-priority grouped entries so bulk Library updates do not overwhelm tastings.

## What Changes

- Add a profile activity feed API that returns a union of activity entry types instead of only tastings.
- Include tasting entries as primary activity and collection-add entries as secondary activity.
- Aggregate collection-add activity by user, destination collection, and time window before it reaches the client.
- Throttle secondary collection-add entries so they fill feed gaps without pushing too many primary tasting entries down.
- Render profile activity with distinct components for primary tasting cards and compact collection-add summaries.
- Link collection-add entries to the destination collection when a web route exists, and link previewed bottles or releases to their catalog pages.
- Preserve existing tasting rendering and existing profile privacy behavior.

## Capabilities

### New Capabilities

- `profile-activity-feed`: Profile activity feed API, activity union schema, secondary collection-add grouping policy, and profile feed rendering behavior.

### Modified Capabilities

## Impact

- Backend oRPC routes: add or extend a user profile activity route with a discriminated activity response.
- Backend schemas and serializers: add activity entry schemas and collection-add summary serialization.
- Backend queries: combine user tastings with recent `collection_bottle` rows joined through the owning collection, ordered by activity time and grouped for secondary entries.
- Web profile route: replace direct `tastings.list({ user })` usage on the Activity tab with the profile activity feed.
- Web components: add a polymorphic profile activity list and compact collection-add item component while reusing existing tasting item rendering.
- Tests: cover activity union response shape, privacy behavior, collection-add grouping/throttling, and existing tasting rendering compatibility.
