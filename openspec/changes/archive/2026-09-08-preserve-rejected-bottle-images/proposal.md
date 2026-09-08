## Why

Approving a price match can restore a StorePrice image that a moderator already removed from the Bottle. The Bottle must remember that specific removed image so matching does not publish it again.

## What Changes

- Save removed Bottle image URLs as Bottle-owned rejection history.
- Skip a StorePrice image when that Bottle has already rejected the same URL.
- Keep different StorePrice images eligible for Bottles that have no image.
- Cover the reported moderator-edit then price-match sequence with an integration test.

## Capabilities

### New Capabilities

- `store-price-image-promotion`: Controls when a StorePrice image may fill an empty Bottle image and preserves moderator rejection of a specific image.

### Modified Capabilities

None.

## Impact

- Bottle database schema and generated migration.
- Moderator Bottle updates and Bottle merge state.
- StorePrice image promotion in Bottle alias assignment.
- Price match queue integration coverage and store-price matching documentation.
