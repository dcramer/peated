import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import {
  getReservedCollection,
  isReservedCollectionSlug,
} from "@peated/server/lib/db";
import { implement } from "@peated/server/orpc";
import collectionBottleUpdateContract from "@peated/server/orpc/contracts/collections/bottles/update";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import {
  findCollectionBottleEntry,
  isLibraryCollection,
  serializeCollectionBottleEntry,
} from "./collectionBottleHelpers";

async function findCollectionById(collectionId: number) {
  return await db.query.collections.findFirst({
    where: (collections, { eq }) => eq(collections.id, collectionId),
  });
}

export default implement(collectionBottleUpdateContract)
  .use(requireAuth)
  .use(requireTosAccepted)
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (user.id !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Cannot modify another user's collection.",
      });
    }

    const collection = isReservedCollectionSlug(input.collection)
      ? await getReservedCollection(db, user.id, input.collection)
      : await findCollectionById(input.collection);

    if (!collection) {
      throw errors.NOT_FOUND({
        message: "Collection not found.",
      });
    }

    if (context.user.id !== collection.createdById) {
      throw errors.FORBIDDEN({
        message: "Cannot modify another user's collection.",
      });
    }

    if (!isLibraryCollection(collection)) {
      throw errors.BAD_REQUEST({
        message: "Bottle status is only supported for Library entries.",
      });
    }

    const collectionBottle = await findCollectionBottleEntry({
      collectionBottleId: input.collectionBottle,
      collectionId: collection.id,
    });
    if (!collectionBottle) {
      throw errors.NOT_FOUND({
        message: "Collection bottle not found.",
      });
    }

    await db
      .update(collectionBottles)
      .set({ status: input.status })
      .where(eq(collectionBottles.id, collectionBottle.id));

    const result = await findCollectionBottleEntry({
      collectionBottleId: collectionBottle.id,
      collectionId: collection.id,
    });
    if (!result) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to load collection bottle.",
      });
    }

    return await serializeCollectionBottleEntry(result, context.user);
  });
