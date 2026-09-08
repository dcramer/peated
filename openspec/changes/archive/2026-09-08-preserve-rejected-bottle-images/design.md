## Context

A Bottle stores one image URL. StorePrice matching can copy a StorePrice image into a Bottle when that value is empty. A moderator can remove an image, but the Bottle does not remember which URL was removed.

Price images already use stable server-owned upload URLs. The Bottle can use those URLs to remember removed images without adding a new image system.

## Goals / Non-Goals

**Goals:**

- Remember each image URL removed from a Bottle.
- Stop the same URL from being copied back by StorePrice matching.
- Keep other image URLs eligible.

**Non-Goals:**

- Do not add image review screens, image records, file hashes, or new public API fields.
- Do not delete the StorePrice image file or remove it from source evidence.

## Decisions

Add a `rejectedImageUrls` text array to Bottle with an empty default. When a moderator clears a present image, add its stored URL to the array in the same Bottle update.

Before StorePrice matching fills an empty image, require that the candidate URL is not in the Bottle's rejected list. Keep this check in the same database update as the empty-image check.

Keep removed URLs after later manual uploads. A new upload has a different URL and does not make an older rejected URL valid again.

When duplicate Bottles merge, keep the selected destination's Bottle data and combine the removed-image URL lists so a rejected image cannot return through moved StorePrices.

## Risks / Trade-offs

- The same bytes captured under a new URL are treated as a new image. Current price capture keeps one stored URL, so content hashes are outside this change.
- The URL list can grow, but moderators remove very few Bottle images and runtime checks read only one Bottle row.
