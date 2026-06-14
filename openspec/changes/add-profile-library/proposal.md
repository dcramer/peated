## Why

Profiles currently expose favorites as the only saved-bottle collection, which limits users who want to distinguish bottles they like from bottles they own, have, or want to catalog. Adding a Library gives profiles a second first-class collection while preserving the existing favorites behavior and API compatibility around the reserved `default` collection token.

## What Changes

- Add a profile Library collection alongside Favorites.
- Keep the reserved collection token `default` mapped to the user's Favorites collection, and document that mapping in code so future collection work does not treat it as a generic default.
- Add a reserved `library` collection token that resolves to a user's Library collection.
- Let authenticated users add and remove bottles or releases from Library using a distinct button and icon from Favorites.
- Show Library as a profile tab, respecting the same profile visibility rules as Favorites.
- Add a signed-in user's own Library page or navigation entry only if the implementation keeps parity with the existing signed-in Favorites shortcut.
- Preserve existing Favorites URLs and API behavior.

## Capabilities

### New Capabilities

- `profile-library`: Public profile Library behavior, reserved collection aliases, and bottle save actions for Favorites and Library.

### Modified Capabilities

## Impact

- Backend collection helpers and oRPC collection bottle routes need to resolve both `default` and `library` reserved aliases.
- Collection list and bottle serialization behavior may need shared constants or helper names so `default` is clearly Favorites.
- Web bottle action components need a separate Library action with a different icon and labels from Favorites.
- Profile tabs and collection pages need Library views using existing privacy and pagination behavior.
- Tests should cover reserved alias resolution, ownership checks, profile visibility, and UI action state for both saved-bottle collections.
