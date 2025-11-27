import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { getDefaultCollection } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Add bottle to collection",
    description:
      "Add a bottle (and optionally a specific release) to a user's collection. Requires authentication and ownership",
    operationId: "addBottleToCollection",
  })
  .input(
    CollectionBottleInputSchema.extend({
      collection: z.union([z.literal("default"), z.coerce.number()]),
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
        ? await getDefaultCollection(db, user.id)
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

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));
    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Cannot find bottle.",
      });
    }

    if (input.release) {
      const release = await db.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.id, input.release),
          eq(bottleReleases.bottleId, bottle.id),
        ),
      });
      if (!release) {
        throw errors.BAD_REQUEST({
          message: "Cannot identify release.",
        });
      }
    }

    await db.transaction(async (tx) => {
      const [cb] = await tx
        .insert(collectionBottles)
        .values({
          collectionId: collection.id,
          bottleId: bottle.id,
          releaseId: input.release || null,
        })
        .onConflictDoNothing()
        .returning();
      if (cb) {
        await tx
          .update(collections)
          .set({
            totalBottles: sql`${collections.totalBottles} + 1`,
          })
          .where(eq(collections.id, collection.id));
      }
    });

    return {};
  });
