import { db } from "@peated/server/db";
import { bottles, collectionBottles, entities } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CollectionBottleSerializer } from "@peated/server/serializers/collectionBottle";
import { TRPCError } from "@trpc/server";
import type { SQL } from "drizzle-orm";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { getUserFromId, profileVisible } from "../../lib/api";
import { getDefaultCollection } from "../../lib/db";

export default authedProcedure
  .input(
    z.object({
      collection: z.union([z.literal("default"), z.number()]),
      user: z.union([z.literal("me"), z.string(), z.number()]),
      cursor: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { cursor, limit, ...input }, ctx }) {
    const user = await getUserFromId(db, input.user, ctx.user);
    if (!user) {
      throw new TRPCError({
        message: "User not found.",
        code: "NOT_FOUND",
      });
    }

    if (!(await profileVisible(db, user, ctx.user))) {
      throw new TRPCError({
        message: "User's profile is private.",
        code: "BAD_REQUEST",
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
      throw new TRPCError({
        message: "Collection not found.",
        code: "NOT_FOUND",
      });
    }

    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(collectionBottles.collectionId, collection.id),
    ];

    const results = await db
      .select({ collectionBottles, bottles })
      .from(collectionBottles)
      .where(where ? and(...where) : undefined)
      .innerJoin(bottles, eq(bottles.id, collectionBottles.bottleId))
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottles.fullName));

    return {
      results: await serialize(
        CollectionBottleSerializer,
        results.slice(0, limit).map(({ collectionBottles, bottles }) => ({
          ...collectionBottles,
          bottle: bottles,
        })),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
