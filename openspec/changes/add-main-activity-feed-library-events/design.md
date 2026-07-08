## Context

The profile activity feed already composes tastings and grouped collection additions at read time. Main activity pages still call `tastings.list({ filter })`, so they cannot surface Library or Favorites additions. The new endpoint needs the existing main feed filters while preserving the profile feed's secondary-activity policy.

## Goals / Non-Goals

**Goals:**

- Provide a top-level main activity feed API for global, friends, and local pages.
- Reuse the existing activity entry contract so profile and main UI can share rendering.
- Centralize activity composition logic so grouping, preview serialization, and throttling do not diverge.
- Mirror the existing tasting feed visibility behavior for all activity sources.
- Keep collection-add entries compact and secondary to tastings.

**Non-Goals:**

- Define new semantics for the local feed; this change preserves the current tasting-filter behavior.
- Add a durable activity table or write-time activity events.
- Add new activity types beyond tastings and collection additions.
- Add custom collection detail pages.
- Change collection privacy or profile visibility rules.

## Decisions

### Add a top-level `activity.list` route

The main feed gets a dedicated `GET /activity` route instead of expanding `tastings.list`. `tastings.list` remains a tasting-specific API, while `activity.list` owns the mixed feed contract and can grow to future activity types.

Alternative considered: return collection additions from `tastings.list`. That would make every tasting-list consumer defensive against non-tasting rows and blur API ownership.

### Extract shared read-time composition helpers

Profile and main feeds should call shared helpers for entry serialization, collection-add grouping, reserved collection links, and secondary throttling. Route files should own source selection and visibility filters; shared helpers should own activity entry assembly.

Alternative considered: copy the profile route logic into a main route. That would be fast initially but would make future changes to grouping or preview behavior error-prone.

### Filter source rows by visible owners

Main feed visibility should match current `tastings.list` behavior:

- `friends` requires an authenticated viewer and includes followed users.
- `global` hides private users from anonymous viewers and from non-followers, while showing the viewer and followed users when authenticated.
- `local` keeps the current behavior, which is effectively the global filtering path until a product-specific local rule exists.

Collection-add source rows use the collection owner as the actor for these visibility rules.

### Keep offset-style page cursors for parity

The existing feed APIs use numeric page cursors. The new route can reuse the profile composition window logic and return numeric next/previous cursors, accepting the same limitations as the current profile feed.

Alternative considered: introduce timestamp cursors. That is more robust for changing timelines, but it would add a pagination model only for this route without solving existing profile-feed parity.

## Risks / Trade-offs

- Read-time grouping queries can grow complex -> keep filtering and composition helpers small, named, and covered by route integration tests.
- Main feeds can include many users, making collection-add grouping heavier than profile grouping -> query only grouped buckets for the current page window and fetch previews per returned group.
- `local` remains underspecified -> preserve existing behavior now and leave a separate change for true local semantics.
- Shared activity schema currently has profile-oriented names -> add generic aliases where useful without breaking existing profile route consumers.

## Migration Plan

No database migration is required. Add the route and shared helper, switch web activity pages to the new route, and leave profile activity on the same response contract. Rollback can restore the web pages to `tastings.list` and remove the top-level route without data changes.

## Open Questions

- Should local activity eventually filter by viewer location, tasting location, or bottle availability region?
- Should custom collection additions remain visible on main feeds before custom collection pages exist, or should the route limit collection-add entries to reserved Library and Favorites?
