import { db } from "@peated/server/db";
import type { CollectionBottle, User } from "@peated/server/db/schema";
import { collectionBottles } from "@peated/server/db/schema";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { and, eq } from "drizzle-orm";

/** Checks whether collection-only unit fields are supported. */
export function isLibraryCollection(collection: { name: string }) {
  return collection.name === RESERVED_COLLECTIONS.library.name;
}

/** Loads a collection entry; its serializer owns authoritative Bottle hydration. */
export async function findCollectionBottleEntry({
  collectionBottleId,
  collectionId,
}: {
  collectionBottleId: number;
  collectionId: number;
}): Promise<CollectionBottle | null> {
  const [result] = await db
    .select()
    .from(collectionBottles)
    .where(
      and(
        eq(collectionBottles.id, collectionBottleId),
        eq(collectionBottles.collectionId, collectionId),
      ),
    )
    .limit(1);

  return result ?? null;
}

/** Serializes a scoped collection entry after route-level ownership checks. */
export async function serializeCollectionBottleEntry(
  entry: CollectionBottle,
  currentUser?: User | null,
) {
  return await serialize(CollectionBottleSerializer, entry, currentUser);
}
