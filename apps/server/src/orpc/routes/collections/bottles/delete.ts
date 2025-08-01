import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { getDefaultCollection } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Remove bottle from collection",
    spec: {
      operationId: "removeBottleFromCollection",
    },
    description:
      "Remove a bottle (and optionally a specific release) from a user's collection. Requires authentication and ownership",
  })
  .input(
    CollectionBottleInputSchema.extend({
      collection: z.union([z.coerce.number(), z.literal("default")]),
      user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
    }),
  )
  .output(z.object({}))
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

    const collection =
      input.collection === "default"
        ? await getDefaultCollection(db, context.user.id)
        : await db.query.collections.findFirst({
            where: (collections, { eq }) =>
              eq(collections.id, input.collection as number),
          });

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

    await db.transaction(async (tx) => {
      const [cb] = await tx
        .delete(collectionBottles)
        .where(
          and(
            eq(collectionBottles.bottleId, input.bottle),
            eq(collectionBottles.collectionId, collection.id),
            input.release
              ? eq(collectionBottles.releaseId, input.release)
              : undefined,
          ),
        )
        .returning();
      if (cb) {
        await tx
          .update(collections)
          .set({
            totalBottles: sql`${collections.totalBottles} - 1`,
          })
          .where(eq(collections.id, collection.id));
      }
    });

    return {};
  });
