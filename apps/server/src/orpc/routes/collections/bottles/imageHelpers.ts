import type { NewPendingUpload } from "@peated/server/db/schema";
import {
  copyPendingImageToCollectionBottle,
  getUsablePendingUpload,
  PendingUploadPurposeError,
} from "@peated/server/lib/pendingUploads";

export const COLLECTION_BOTTLE_IMAGE_PENDING_PURPOSE =
  "photo_tasting_entry" satisfies NewPendingUpload["purpose"];

/** Copies a scan pending image into collection-bottle storage for one Library entry. */
export async function copyPendingImageForCollectionBottle({
  pendingImageId,
  userId,
  collectionBottleId,
}: {
  pendingImageId: string;
  userId: number;
  collectionBottleId: number;
}) {
  return await copyPendingImageToCollectionBottle({
    id: pendingImageId,
    userId,
    purpose: COLLECTION_BOTTLE_IMAGE_PENDING_PURPOSE,
    collectionBottleId,
  });
}

/** Validates that a scan pending image is still usable for a Library image copy. */
export async function validatePendingImageForCollectionBottle({
  pendingImageId,
  userId,
}: {
  pendingImageId: string;
  userId: number;
}) {
  const pendingUpload = await getUsablePendingUpload({
    id: pendingImageId,
    userId,
  });
  if (pendingUpload.purpose !== COLLECTION_BOTTLE_IMAGE_PENDING_PURPOSE) {
    throw new PendingUploadPurposeError("Pending upload purpose mismatch.");
  }
}
