## Context

Peated already stores saved bottles in the generic `collection` and `collection_bottle` tables. The existing Favorites behavior is implemented through the reserved collection route token `default`, but user-facing copy calls this Favorites and the bottle serializer checks for a collection whose lower-cased name is `default`.

The Library feature should build on that storage model instead of introducing a new table. The main design need is to make reserved collection names explicit so the historical `default` token remains API-compatible while clearly meaning Favorites, and so the new `library` token has the same route behavior.

## Goals / Non-Goals

**Goals:**

- Add a first-class Library collection that can be shown on profiles and toggled from bottle/release surfaces.
- Preserve the existing `default` collection token for Favorites.
- Make reserved collection resolution centralized and named around user-visible concepts.
- Keep Favorites and Library independent; saving to one collection MUST NOT imply saving to the other.
- Reuse the existing profile privacy model, collection bottle serializers, and pagination behavior.

**Non-Goals:**

- Add arbitrary user-defined collection management.
- Rename or remove the public `default` token.
- Add a new persistence table for Library.
- Add release ownership, inventory counts, purchase dates, or cellar-management metadata.
- Add a top-level `/library` shortcut or primary navigation item; Library is exposed through profile tabs for this change.

## Decisions

### Use reserved collection aliases over new tables

Implement Library as a reserved collection alias backed by `collections.name = "Library"`, parallel to Favorites backed by `collections.name = "Default"`.

Alternative considered: add a dedicated `user_library_bottle` table. That would make Library easier to query by type, but it would duplicate collection behavior, serializers, total counts, release handling, and repair/merge integration already present in `collection_bottle`.

### Centralize reserved collection resolution

Add shared constants and helpers for reserved collections, for example `default` -> Favorites / `Default` and `library` -> Library / `Library`. Keep a compatibility wrapper if existing callers still need `getDefaultCollection`, but document that `default` is the historical API slug for Favorites.

The helper should support lookup and create-on-write modes. Reads of a missing reserved collection can return an empty list without creating rows; creates should lazily create the backing collection. Deletes against a missing reserved collection can be a no-op for reserved aliases.

Alternative considered: inline `input.collection === "default" || "library"` checks in each route. That is smaller initially, but it repeats the same mapping and makes the `default` means Favorites convention easier to lose.

### Keep collection routes as the Library API surface

Extend collection bottle route schemas from `z.literal("default")` to a reserved collection alias enum plus numeric custom collection IDs. Existing custom collection ID behavior remains unchanged.

Profile Favorites and Library pages should use `collections.bottles.list` with `collection: "default"` or `collection: "library"` rather than relying on bottle list filters. This keeps profile pages aligned with the saved-collection API and avoids adding a new `isInLibrary` bottle serializer field just to render the profile tab.

Alternative considered: add `collection: "favorites" | "library"` to `bottles.list`. That may be useful later for search/filter workflows, but it is not necessary for profile collection pages and would mix saved-collection semantics into the general bottle search endpoint.

### Add separate action components for Favorites and Library

Keep the existing star/Favorites behavior, then add a Library action using a distinct icon and label, such as Heroicons `BookmarkIcon`. The two controls can share internal toggle plumbing, but the user-facing buttons should remain visually distinct.

Alternative considered: replace the single Favorites button with a collection picker. That would scale to arbitrary collections, but it is heavier than this request and less direct for the two first-class actions.

## Risks / Trade-offs

- Existing helper behavior may accidentally resolve the wrong collection if it returns the first collection for a user -> use name-based reserved lookup and add tests with both Default and Library present.
- Creating collections from profile reads can add unexpected rows -> separate read lookup from create-on-write behavior.
- Two adjacent icon-only buttons can be ambiguous -> use accessible titles/tooltips and distinct icons/active states.
- Profile Favorites currently has a different query shape than the authenticated Favorites page -> update profile Favorites while adding Library so the two tabs use the same collection API.

## Migration Plan

No schema migration is required. Existing users keep their `Default` collection rows as Favorites. Library rows are created lazily when a user first saves a bottle to Library. If rollback is needed, the `library` reserved alias and UI can be removed without affecting Favorites; existing `Library` collection rows would remain ordinary collection data unless explicitly cleaned up later.

## Open Questions

None.
