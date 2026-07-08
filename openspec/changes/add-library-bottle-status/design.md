## Context

Peated already models a user's Library as the reserved `library` collection, with entries stored in `collection_bottle`. Library entries currently carry entry-specific data such as `image_url`, while bottle and release identity remains canonical in the bottle tables. Bottle status is another entry-specific property: one user's bottle can be sealed while another user's copy of the same bottle is open or empty.

The web Library page is backed by `collections.bottles.list` and renders entry-specific controls through `LibraryEntryActions`. This provides a natural place to expose inline status controls for the owner and passive badges for viewers.

## Goals / Non-Goals

**Goals:**

- Store optional Library bottle status as `sealed`, `open`, `empty`, or unset.
- Keep unset distinct from `sealed` so existing and casual Library entries do not imply collector-grade condition.
- Expose status in collection bottle API responses, Library list filters, create input, and an entry update mutation.
- Let the Library owner update status directly from the Library list and from the add-to-Library confirmation state.
- Keep status terminology collector-friendly while avoiding whisky-specific ambiguity around "finished".

**Non-Goals:**

- Track fill level, percentage remaining, storage location, purchase price, or acquisition history.
- Change bottle or release identity, search matching, tasting behavior, or favorite collection behavior.
- Require every Library entry to have a status.
- Support status on non-Library collections in the initial rollout.

## Decisions

### Store status on `collection_bottle`

Status belongs on `collection_bottle` because it describes a user's physical copy or historical Library entry, not the global bottle or release. The implementation should add nullable status storage to `collection_bottle` and include that field in the existing `CollectionBottle` type and serializer.

Alternative considered: storing status on `bottle` or `bottle_release`. That would incorrectly make a user-specific inventory state global.

### Use nullable enum values `sealed`, `open`, and `empty`

The stored values should be `sealed`, `open`, and `empty`, with `null` meaning status is not tracked. The UI labels should be `Sealed`, `Open`, and `Empty`. The UI may use `Not set` only in filter or edit contexts.

Alternative considered: `unopened`, `opened`, and `finished`. `unopened/opened` is clearer for casual users, but `sealed/open/empty` better matches the desired collector feel. `finished` is rejected because whisky commonly uses finished to describe cask finishing.

### Add a collection bottle update route

Status updates should use an entry-level update route rather than overloading add or image-specific routes:

`PATCH /users/{user}/collections/{collection}/bottles/{collectionBottle}`

The route should authorize the collection owner, require the entry to belong to the resolved collection, support Library entries only for status updates, and return the serialized `CollectionBottle`.

Alternative considered: creating a status-only route. A general entry update route is a better fit for future entry-level fields such as notes or purchase metadata.

### Keep create status optional

`collections.bottles.create` should accept optional nullable status. If omitted, the entry remains unset. If the entry already exists, the route should only update status when status was explicitly provided by the caller, preserving existing idempotent add behavior.

Alternative considered: defaulting create to `sealed`. That would make older and casual entries appear more certain than they are.

### Expose owner editing inline and viewer status passively

The Library owner should see compact inline chips for `Sealed`, `Open`, and `Empty`, backed by the update mutation and list cache updates. Viewers should see only a passive badge when status is set. Unset entries should not show a row badge by default.

Alternative considered: putting all status updates in the overflow menu. Inline chips make the feature useful for inventory maintenance from the Library list, while the overflow menu can still offer clear status.

## Risks / Trade-offs

- Existing rows have no status → Keep the column nullable and avoid defaulting to `sealed`.
- Row UI may become dense → Use compact chips only for the owner and passive badges for viewers; keep clear status in the overflow menu.
- Non-Library collections may later want status → Restrict initial behavior to Library to match the product intent, but implement via an entry update route that can expand later.
- Cache updates can drift across filtered lists → Optimistically update the visible row and invalidate Library list/status queries after mutation.

## Migration Plan

1. Add the nullable status column through Drizzle schema changes and `pnpm db:generate`.
2. Deploy backend support for nullable status, preserving existing `null` values.
3. Deploy frontend display, inline mutation, and filters.
4. Rollback is low risk: remove UI usage first; the nullable column can remain unused if necessary.

## Open Questions

- Should selected inline chips be visible on every owner row immediately, or should unset rows show a smaller `Set status` control until the user chooses a value?
- Should clicking the currently selected chip be a no-op, or should clear status remain available only through the overflow menu?
