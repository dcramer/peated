## Context

Peated currently has three related but separate workflows:

- `/addTasting` is a photo-first tasting flow that identifies a bottle, then immediately renders the tasting form.
- `/addBottle` is a manual catalog creation form, even though scan, search, and follow-up outcomes need one shared resolver.
- Library and Favorites are saved-collection actions on existing bottle surfaces, with no image on the saved collection entry.

The new bottle flow should make bottle identification the shared first step. After identification, the user can add the bottle to Library, log a tasting, view the bottle, or add the catalog bottle when the bottle is missing.

Photo identification follows the same product model as the rest of the classifier: first identify the observed bottle plus exact release or bottling details, then decide whether that identity maps to an existing Peated target or a create proposal. Peated catalog search and web search are evidence sources, not substitutes for the observed bottle identity. Manual search is the fallback only when the observed bottle identity is unresolved or ambiguous.

## Goals / Non-Goals

**Goals:**

- Make `/addBottle` the shared bottle resolver route with intent-specific titles.
- Rename visible tasting actions and titles from Add/Record Tasting to Log a tasting.
- Move the current manual catalog creation form to `/bottles/new` with Add a bottle copy.
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

### `/addBottle` becomes the shared resolver route

Use `/addBottle` for the shared resolver because every intent first identifies a bottle. Use Find a bottle when there is no specific intent. Use Add a bottle only for catalog contribution, Add to your Library for Library entry, and Log a tasting for tasting entry. Move the existing manual catalog form to `/bottles/new` with the title and primary action Add a bottle. Existing admin or moderation links that depend on current `/addBottle` query parameters can redirect to `/bottles/new` during migration.

Alternative considered: use Add a bottle for every resolver intent. Rejected because the shared resolver does not add anything until the user chooses an outcome, and the label conflates catalog creation with Library and tasting actions.

### Bottle resolution is shared before intent-specific actions

Extract the scan/search/review logic from `/addTasting` into a reusable Bottle Resolver. The resolver returns a bottle target, optional release, optional pending image, and result provenance. Intent controls the preferred next action:

- `intent=library`: Add to Library is primary.
- `intent=tasting`: Log a tasting is primary.
- `intent=catalog`: Add a bottle is primary for a create proposal; View bottle is primary for an existing match.
- no intent or `intent=choose`: use Find a bottle and show all applicable outcomes without presenting one as the stated intent.

Existing bottle matches show Add to Library, Log a tasting, and View bottle. Clear missing-target create proposals show Add to Library, Log a tasting, and Add a bottle; unresolved or ambiguous bottles show Search again, Start over, and Add a new bottle when user creation is available.

For scan-backed results, the classifier should preserve release and bottling traits visible on the label, including edition, batch, barrel/cask number, stated age, ABV, and expression name. If the exact identity exists in Peated, the resolver should confirm the match. If it does not exist and the identity is otherwise clear, the resolver should confirm a create proposal. Search Again should mean "the system could not identify the bottle/release," not "the target row is missing enrichment."

### Review policy is audited after classifier correctness

`reviewPolicy.ts` remains a final safety gate for impossible states, unknown target ids, non-whisky inputs, direct extracted-field conflicts, and explicit automation caps. It should not become a second classifier that re-scores names, requires local text-rank proof, or downgrades a correct match/create because the database row is incomplete.

When a scan-backed eval fails, diagnose the layer in this order:

1. Image extraction missed visible label facts.
2. The classifier chose the wrong bottle/release outcome from available evidence.
3. Review policy contradicted an otherwise correct classifier decision.

Only the third case should relax review policy, and the relaxation should remove or narrow the deterministic gate that caused the downgrade rather than adding family-specific matching rules.

### Deterministic whisky rules stay closed-form

The bottle resolver follows the classifier's deterministic boundary.
Deterministic code may parse closed-form identifiers and preserve source-backed
facts, but it should not decide whisky-family semantics from string similarity
or brand-specific heuristics.

The explicit whisky-domain exception is SMWS exact-cask identity:

- SMWS cask-code syntax such as `95.71`, `RW6.5`, or `G15.1` may
  deterministically anchor the bottle identity.
- The curated SMWS code table may roughly derive distillery/category from the
  first code segment.
- A visible or extracted SMWS subtitle may be preserved in the create proposal
  display name, for example `95.71 Prepare for Winter`.
- The subtitle itself is not deterministic: code must not invent, correct, or
  choose between ambiguous titles.

Other single-cask, barrel, batch, private-selection, brand-prefix, and
retailer-title patterns remain classifier/evidence decisions. They can inform
extraction and observations, but they cannot bypass the agent or review
contract.

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

After adding to Library, show an Add to your Library flow with the saved entry and image. Primary action: Add another to Library. Secondary action: View Library. Add another to Library clears resolver state and starts a fresh Library-intent flow, even when the user entered with another intent and chose Library as a secondary outcome.

## Risks / Trade-offs

- Pending upload semantics may conflict with existing attached/cleanup behavior. -> Update helper tests first and keep expiry/ownership checks authoritative.
- Moving `/addBottle` can break admin/moderation links. -> Redirect legacy query patterns to `/bottles/new` until callers are migrated.
- Shared flow copy can promise the wrong outcome. -> Derive the title and preferred action from intent; reserve Add a bottle for catalog contribution.
- Library images on collection entries may not appear in existing bottle tables. -> Serialize `imageUrl` and update Library views deliberately without changing canonical bottle art.
- Catalog image approval could be misunderstood as private. -> Use "public image" in help text and hide the control when promotion is not allowed.
- Deterministic review policy may block clear scan-backed classifier outcomes. -> Add evals that prove the classifier result first, then audit policy gates for deletion or narrowing instead of adding new whisky-family heuristics.

## Migration Plan

1. Add backend image model/API support for collection entries and reusable pending image copies.
2. Move the current manual `/addBottle` form to `/bottles/new` and add redirects for legacy create links.
3. Extract the existing `/addTasting` resolver into a reusable component while keeping current tasting behavior intact.
4. Make `/addBottle` render the shared bottle resolver and outcome selection.
5. Add the Added to Library terminal state and Library row image/menu UI.
6. Update user-facing copy to Log a tasting across navigation, buttons, titles, and empty states.
7. Add scan-backed classifier evals for observed production misses, including extractor facts, final catalog outcome, one-click resolver expectation, and provenance.
8. Audit review policy gates that still downgrade eval-proven correct classifier outcomes and remove or narrow those gates after the classifier layer is correct.

## Open Questions

- Should the catalog image approval checkbox default on when a new bottle has no image and the scan is highly suitable?
- Should Library image replacement live on the profile Library row, a future collection entry detail page, or both?
- Should `/addTasting` redirect to `/addBottle?intent=tasting` after the shared flow ships, or remain a compatibility route indefinitely?
