import { db } from "@peated/server/db";
import type {
  Bottle,
  BottleRelease,
  CollectionBottle,
  NewPendingUpload,
  User,
} from "@peated/server/db/schema";
import {
  bottleReleases,
  bottles,
  collectionBottles,
} from "@peated/server/db/schema";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
import {
  copyPendingImageToCollectionBottle,
  getUsablePendingUpload,
  PendingUploadPurposeError,
} from "@peated/server/lib/pendingUploads";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { and, eq } from "drizzle-orm";

export const COLLECTION_BOTTLE_IMAGE_PENDING_PURPOSE =
  "photo_tasting_entry" satisfies NewPendingUpload["purpose"];

export type CollectionBottleWithTarget = CollectionBottle & {
  bottle: Bottle;
  release: BottleRelease | null;
};

/** Checks that collection image mutations stay scoped to the reserved Library. */
export function isLibraryCollection(collection: { name: string }) {
  return collection.name === RESERVED_COLLECTIONS.library.name;
}

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

/** Loads a collection entry with its target bottle or release for response serialization. */
export async function findCollectionBottleWithTarget({
  collectionBottleId,
  collectionId,
}: {
  collectionBottleId: number;
  collectionId: number;
}): Promise<CollectionBottleWithTarget | null> {
  const [result] = await db
    .select({
      collectionBottle: collectionBottles,
      bottle: bottles,
      release: bottleReleases,
    })
    .from(collectionBottles)
    .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
    .leftJoin(
      bottleReleases,
      eq(bottleReleases.id, collectionBottles.releaseId),
    )
    .where(
      and(
        eq(collectionBottles.id, collectionBottleId),
        eq(collectionBottles.collectionId, collectionId),
      ),
    )
    .limit(1);

  if (!result) {
    return null;
  }

  return {
    ...result.collectionBottle,
    bottle: result.bottle,
    release: result.release,
  };
}

/** Serializes a scoped collection entry after route-level ownership checks. */
export async function serializeCollectionBottleEntry(
  entry: CollectionBottleWithTarget,
  currentUser?: User | null,
) {
  return await serialize(CollectionBottleSerializer, entry, currentUser);
}
