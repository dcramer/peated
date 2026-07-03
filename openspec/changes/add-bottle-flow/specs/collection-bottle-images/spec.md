## ADDED Requirements

### Requirement: Collection bottle image storage

The system SHALL store an optional user-owned image URL on each collection bottle entry.

#### Scenario: Collection entry has image URL

- **WHEN** a collection bottle entry has a saved image
- **THEN** collection bottle responses include the entry image URL

#### Scenario: Collection entry without image

- **WHEN** a collection bottle entry has no saved image
- **THEN** collection bottle responses return a null image URL for the entry

### Requirement: Save Library image during add

The system SHALL allow an authenticated user to save a pending image as the image for a Library collection bottle entry while adding the bottle or release to Library.

#### Scenario: Add bottle to Library with image

- **WHEN** an authenticated user adds a bottle to Library with an owned, unexpired pending image
- **THEN** the system copies the pending image to a permanent collection bottle image location and saves the URL on the Library entry

#### Scenario: Add release to Library with image

- **WHEN** an authenticated user adds a bottle release to Library with an owned, unexpired pending image
- **THEN** the system copies the pending image to a permanent collection bottle image location and saves the URL on the Library release entry

#### Scenario: Add to Library without image

- **WHEN** an authenticated user adds a bottle or release to Library without a pending image
- **THEN** the system creates or preserves the Library entry without requiring an image

#### Scenario: Existing Library entry with new image

- **WHEN** an authenticated user adds a bottle or release that is already in their Library with an owned, unexpired pending image
- **THEN** the system replaces the existing Library entry image with a copied permanent collection bottle image URL

#### Scenario: Existing Library entry without new image

- **WHEN** an authenticated user adds a bottle or release that is already in their Library without a pending image
- **THEN** the system preserves the existing Library entry image URL

### Requirement: Replace Library image

The system SHALL allow the owner of a Library collection bottle entry to replace its image.

#### Scenario: Replace image

- **WHEN** the Library owner replaces an entry image with an owned, unexpired pending image
- **THEN** the system copies the pending image to a permanent collection bottle image location and updates the Library entry image URL

#### Scenario: Cannot replace another user's image

- **WHEN** a user attempts to replace the image for another user's Library entry
- **THEN** the system rejects the request with an authorization error

#### Scenario: Pending image expired

- **WHEN** the Library owner attempts to replace an entry image with an expired pending image
- **THEN** the system rejects the request without changing the existing entry image URL

### Requirement: Remove Library image

The system SHALL allow the owner of a Library collection bottle entry to remove its image.

#### Scenario: Remove image

- **WHEN** the Library owner removes an entry image
- **THEN** the system clears the Library entry image URL

#### Scenario: Cannot remove another user's image

- **WHEN** a user attempts to remove the image for another user's Library entry
- **THEN** the system rejects the request with an authorization error

### Requirement: Reusable pending image copies

The system SHALL allow an owned, unexpired pending image to be copied to multiple approved permanent destinations before it expires.

#### Scenario: Copy pending image to Library and tasting

- **WHEN** a user copies the same owned, unexpired pending image to a Library entry and a tasting
- **THEN** both permanent destinations receive their own copied image URL

#### Scenario: Copy pending image to Library and catalog image

- **WHEN** a user copies the same owned, unexpired pending image to a Library entry and approves it as a new catalog bottle or release image
- **THEN** both permanent destinations receive their own copied image URL

#### Scenario: Pending image expires

- **WHEN** a pending image has expired
- **THEN** the system rejects additional permanent copies from that pending image

### Requirement: Collection images do not change canonical bottle images

The system SHALL keep collection bottle images separate from canonical bottle and release images.

#### Scenario: Save Library image

- **WHEN** a user saves an image on a Library collection entry
- **THEN** the system does not change the associated bottle or release image URL

#### Scenario: Replace Library image

- **WHEN** a user replaces an image on a Library collection entry
- **THEN** the system does not change the associated bottle or release image URL
