## Context

Peated currently has three related but separate workflows:

- `/addTasting` is a photo-first tasting flow that identifies a bottle, then immediately renders the tasting form.
- `/addBottle` is a manual catalog creation form, even though the user-facing phrase "add bottle" now needs to mean the broader act of adding a bottle to Peated.
- Library and Favorites are saved-collection actions on existing bottle surfaces, with no image on the saved collection entry.

The new Add Bottle flow should make bottle identification the shared first step. After identification, the user can add the bottle to Library, log a tasting, view the bottle, or create the catalog bottle when the bottle is missing.

## Goals / Non-Goals

**Goals:**

- Make `/addBottle` the user-facing universal Add Bottle route.
- Rename visible tasting actions and titles from Add/Record Tasting to Log Tasting.
- Move the current manual catalog creation form to a Create Bottle route, preferably `/bottles/new`.
- Reuse photo identification, search, and manual creation as branches of one resolver flow.
- Store Library-specific images on `collection_bottle.image_url`.
- Let a pending scan image be copied to Library, tasting, and approved catalog image destinations before it expires.
- Require explicit user approval before a scan image becomes a public catalog bottle or release image.

**Non-Goals:**

- Replace bottle-scoped tasting deep links in the first iteration.
- Add a Favorites-with-image flow now, even though the data model can support images on any collection entry.
- Make user Library images canonical bottle or release images by default.
- Let photo identification create or overwrite catalog images without user approval and deterministic policy checks.

## Decisions

### `/addBottle` becomes the universal route

Use `/addBottle` for the user-facing Add Bottle flow because that is the plain-language action users expect. Move the existing manual catalog form to `/bottles/new` with the title and primary action Create Bottle. Existing admin or moderation links that depend on current `/addBottle` query parameters can redirect to `/bottles/new` during migration.

Alternative considered: create a new route such as `/checkIn` or `/captureBottle`. This avoids route migration but leaves the clearest label unused and keeps `/addBottle` ambiguous.

### Bottle resolution is shared before intent-specific actions

Extract the scan/search/review logic from `/addTasting` into a reusable Bottle Resolver. The resolver returns a bottle target, optional release, optional pending image, and result provenance. Intent controls the preferred next action:

- `intent=library`: Add to Library is primary.
- `intent=tasting`: Log Tasting is primary.
- no intent or `intent=choose`: show all applicable outcomes.

Existing bottle matches show Add to Library, Log Tasting, and View Bottle. Missing or uncertain bottles show Search Again, Start Over, and Create Bottle when user creation is available.

### Collection entry images are user-owned images

Add `image_url` to `collection_bottle`. This represents a user's photo for their saved bottle or release. It does not replace `bottles.image_url` or `bottle_releases.image_url`, and it should be serialized with collection bottle list/detail responses.

Library add can save the resolver's pending image to the collection entry. Library rows should show the saved image as a thumbnail and expose owner actions for editing the image or removing the entry from Library.

### Pending images remain reusable until expiry

A pending image can be copied to multiple permanent destinations before it expires. Copying it to one destination must not make it unavailable for another approved destination in the same flow. The implementation may update pending upload status/copy metadata, but `getUsablePendingUpload` or the copy path must still allow additional copies while ownership, purpose, and expiry checks pass.

This supports cases such as adding a bottle to Library and later logging a tasting from the same scan, or creating a bottle and approving the same scan as the initial catalog image.

### Catalog image approval language

When creating a new bottle or release from a scan, show an explicit approval control only when policy allows the image to become a public catalog image. Recommended copy:

- Label: **Set as bottle image**
- Help text: **This photo will be shown as the public image for the new bottle.**

For a release target, use **Set as release image** and **This photo will be shown as the public image for the new release.**

The control should be unchecked unless product decides the scan suitability and creation context make opt-in-by-default acceptable. Regardless of default, saving must require the user's submitted form state. The copy should describe approval, not generic upload reuse.

### Added to Library is a terminal state

After adding to Library, keep the user in the Add Bottle flow and show an Added to Library state with the saved entry and image. Primary action: Add Another Bottle. Secondary action: View Library. Add Another Bottle clears resolver state and starts a fresh Add Bottle flow.

## Risks / Trade-offs

- Pending upload semantics may conflict with existing attached/cleanup behavior. -> Update helper tests first and keep expiry/ownership checks authoritative.
- Moving `/addBottle` can break admin/moderation links. -> Redirect legacy query patterns to `/bottles/new` until callers are migrated.
- "Add Bottle" can still sound like catalog creation. -> Use Create Bottle consistently for the manual catalog branch.
- Library images on collection entries may not appear in existing bottle tables. -> Serialize `imageUrl` and update Library views deliberately without changing canonical bottle art.
- Catalog image approval could be misunderstood as private. -> Use "public image" in help text and hide the control when promotion is not allowed.

## Migration Plan

1. Add backend image model/API support for collection entries and reusable pending image copies.
2. Move the current manual `/addBottle` form to `/bottles/new` and add redirects for legacy create links.
3. Extract the existing `/addTasting` resolver into a reusable component while keeping current tasting behavior intact.
4. Make `/addBottle` render the Add Bottle resolver and outcome selection.
5. Add the Added to Library terminal state and Library row image/menu UI.
6. Update user-facing copy to Log Tasting across navigation, buttons, titles, and empty states.

## Open Questions

- Should the catalog image approval checkbox default on when a new bottle has no image and the scan is highly suitable?
- Should Library image replacement live on the profile Library row, a future collection entry detail page, or both?
- Should `/addTasting` redirect to `/addBottle?intent=tasting` after the shared flow ships, or remain a compatibility route indefinitely?
