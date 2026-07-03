## Why

Bottle entry currently splits across tasting-first photo lookup, direct catalog creation, and separate Library/Favorites actions. Users need one Add Bottle flow that starts by identifying a bottle, then lets them add it to Library, log a tasting, view the bottle, or create the catalog bottle when Peated does not have it yet.

## What Changes

- Make `/addBottle` the user-facing Add Bottle flow for scan, search, and outcome selection.
- Move the current manual catalog creation form behind a Create Bottle route, preferably `/bottles/new`, with user-facing copy changed from Add Bottle to Create Bottle.
- Reuse the existing photo identification path as a shared bottle resolver instead of making it tasting-only.
- Replace user-facing Add/Record Tasting copy with Log Tasting.
- Add Library image support by storing a user-specific image on `collection_bottle`.
- Let Library add save a pending scan/upload image to the collection bottle entry and end on an Added to Library confirmation screen.
- Add a way to replace or remove a Library entry image after the bottle has already been added.
- Allow a pending scan image to be copied to multiple permanent destinations before it expires.
- When creating a new catalog bottle from a scan, offer explicit user approval to use the scan image as the catalog bottle or release image when policy allows.

## Capabilities

### New Capabilities

- `add-bottle-flow`: Universal Add Bottle flow, resolver outcomes, route/copy behavior, and Library/Tasting/View/Create branches.
- `collection-bottle-images`: User-owned collection bottle images, create-time save behavior, replacement/removal, and pending image copy semantics.

### Modified Capabilities

## Impact

- Web routes and navigation: `/addBottle`, current manual add bottle form, `/search` intent handling, and visible Log Tasting copy.
- Web components: photo resolver UI, search results, Library confirmation screen, Tasting form entry points, and collection bottle image controls.
- Backend APIs: collection bottle create/list serializers, image update/delete routes for collection entries, pending upload copy behavior, and optional catalog image promotion on bottle creation.
- Database: add nullable `image_url` to `collection_bottle`; add upload namespace support for collection bottle images.
- Tests: backend route tests for collection image persistence/ownership and UI/browser checks for scan/search/create outcomes.
