import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { TRPCError } from "@trpc/server";
import { and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { getUserFromId, profileVisible } from "../../lib/api";

export default authedProcedure
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.number()]),
      bottle: z.number().optional(),
      page: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { page, limit, ...input }, ctx }) {
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

    const offset = (page - 1) * limit;

    const where = [];
    if (input.bottle) {
      where.push(
        sql`EXISTS(SELECT 1 FROM ${collectionBottles} WHERE ${collectionBottles.bottleId} = ${input.bottle} AND ${collectionBottles.collectionId} = ${collections.id})`,
      );
    }

    const results = await db
      .select()
      .from(collections)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(collections.name));

    return {
      results: await serialize(
        CollectionSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  });
