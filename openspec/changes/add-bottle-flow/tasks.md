## 1. Backend Collection Image Model

- [x] 1.1 Add nullable `image_url` to `collection_bottle` with a Drizzle-generated migration.
- [x] 1.2 Add `imageUrl` to `CollectionBottleSchema`, server types, and `CollectionBottleSerializer`.
- [x] 1.3 Add a permanent upload namespace for collection bottle images.
- [x] 1.4 Update collection bottle list tests to cover entries with and without `imageUrl`.

## 2. Pending Upload Copy Semantics

- [x] 2.1 Update pending upload copy helpers so an owned, unexpired pending image can be copied to multiple permanent destinations before expiry.
- [x] 2.2 Preserve ownership, purpose, and expiry validation for every copy.
- [x] 2.3 Update pending upload cleanup behavior and tests so reusable copied images are not deleted before permanent copies exist.
- [x] 2.4 Add tests for copying the same pending image to Library plus tasting or catalog image destinations.

## 3. Library Image APIs

- [x] 3.1 Extend `collections.bottles.create` to accept optional `pendingImageId`.
- [x] 3.2 Save the copied pending image URL on new Library collection bottle entries.
- [x] 3.3 Define and implement behavior for existing Library entries when `pendingImageId` is provided.
- [x] 3.4 Return the saved `CollectionBottle` from collection bottle create.
- [x] 3.5 Add authenticated owner-only image replace support for Library entries.
- [x] 3.6 Add authenticated owner-only image removal support for Library entries.
- [x] 3.7 Add route tests for create-time image save, replacement, removal, ownership rejection, expiry rejection, and canonical bottle image isolation.

## 4. Route Restructure

- [x] 4.1 Move the current manual `/addBottle` form to `/bottles/new` with visible Create Bottle copy.
- [x] 4.2 Add compatibility redirects or link updates for current `/addBottle` create-form query patterns.
- [x] 4.3 Update manual bottle creation return behavior so it can continue to Library, Log Tasting, View Bottle, or Add Bottle outcomes.
- [x] 4.4 Update search add-missing-bottle links to target Create Bottle while preserving Add Bottle intent.

## 5. Add Bottle Resolver UI

- [x] 5.1 Extract photo scan, preview, identification, result review, start-over, and search fallback from `/addTasting` into a reusable resolver component.
- [x] 5.2 Update `/addTasting` or its replacement path to use the resolver with tasting intent without changing successful tasting behavior.
- [x] 5.3 Make `/addBottle` render the resolver and outcome selection for existing, missing, and create-proposal results.
- [x] 5.4 Update `/search` to understand Add Bottle intent instead of only the `tasting` boolean.
- [x] 5.5 Add View Bottle, Add to Library, Log Tasting, Search Again, Start Over, and Create Bottle actions for the appropriate resolver states.

## 6. Library Flow UI

- [x] 6.1 Add a Library confirmation step with bottle or release card and image field seeded from the scan image when present.
- [x] 6.2 Submit Library adds through the collection bottle create API with optional `pendingImageId`.
- [x] 6.3 Add an Added to Library terminal state showing the saved entry and image.
- [x] 6.4 Add Add Another Bottle behavior that resets the resolver and starts a fresh Add Bottle flow.
- [x] 6.5 Add View Library behavior that routes to the current user's Library page.
- [x] 6.6 Add Library image replace/remove UI at the selected Library editing surface.

## 7. Catalog Image Approval

- [ ] 7.1 Add approval controls for creating a new public bottle or release image from a scan when promotion policy allows it.
- [ ] 7.2 Use Set as Bottle Image copy with help text explaining the photo will be shown as the public image for the new bottle.
- [ ] 7.3 Use Set as Release Image copy with help text explaining the photo will be shown as the public image for the new release.
- [ ] 7.4 Ensure unchecked or disallowed catalog image approval never writes canonical bottle or release image URLs.
- [ ] 7.5 Return partial-success messaging if catalog image copy fails after bottle or release creation succeeds.

## 8. User-Facing Copy

- [x] 8.1 Replace visible Add Tasting and Record Tasting copy with Log Tasting across buttons, page titles, empty states, and resolver actions.
- [ ] 8.2 Keep Add Bottle copy for the universal flow and Create Bottle copy for catalog creation.
- [ ] 8.3 Review error and success copy for plain-language consistency.

## 9. Verification

- [x] 9.1 Run targeted backend tests for collection bottle routes, pending uploads, and tasting image attach behavior.
- [x] 9.2 Run targeted web checks for Add Bottle, Create Bottle, search intent, and Log Tasting copy changes.
- [ ] 9.3 Use local UI verification at mobile and desktop widths for scan to Library, search to Library, create bottle, Add Another Bottle, View Library, and Log Tasting paths.
- [x] 9.4 Run relevant package typechecks and lint for touched server and web surfaces.
