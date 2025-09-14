import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  collectionBottles,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { getDefaultCollection } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import { CollectionBottleSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import type { SQL } from "drizzle-orm";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "List collection bottles",
    description:
      "Retrieve bottles in a user's collection with pagination support. Respects privacy settings",
    operationId: "listCollectionBottles",
  })
  .input(
    z.object({
      collection: z.union([z.literal("default"), z.coerce.number()]),
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  // TODO(response-envelope): use helper to enable later switch to { data, meta }
  .output(listResponse(CollectionBottleSchema))
  .handler(async function ({ input, context, errors }) {
    const { cursor, limit } = input;

    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is private.",
      });
    }

    const collection =
      input.collection === "default"
        ? await getDefaultCollection(db, user.id)
        : await db.query.collections.findFirst({
            where: (collections, { and, eq }) =>
              and(
                eq(collections.createdById, user.id),
                eq(collections.id, input.collection as number),
              ),
          });

    if (!collection) {
      throw errors.NOT_FOUND({
        message: "Collection not found.",
      });
    }

    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(collectionBottles.collectionId, collection.id),
    ];

    const results = await db
      .select({ collectionBottles, bottle: bottles, release: bottleReleases })
      .from(collectionBottles)
      .where(where ? and(...where) : undefined)
      .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .leftJoin(
        bottleReleases,
        eq(bottleReleases.id, collectionBottles.releaseId),
      )
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottles.fullName));

    return {
      results: await serialize(
        CollectionBottleSerializer,
        results
          .slice(0, limit)
          .map(({ collectionBottles, bottle, release }) => ({
            ...collectionBottles,
            release,
            bottle,
          })),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
