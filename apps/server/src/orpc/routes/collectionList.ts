import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { getUserFromId, profileVisible } from "../../lib/api";
import { requireAuth } from "../middleware";

export default procedure
  .use(requireAuth)
  .route({ method: "GET", path: "/users/:user/collections" })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      bottle: z.coerce.number().optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(z.any()),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({ input: { cursor, limit, ...input }, context }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw new ORPCError("NOT_FOUND", {
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw new ORPCError("BAD_REQUEST", {
        message: "User's profile is private.",
      });
    }

    const offset = (cursor - 1) * limit;

    const where = [sql`${collections.createdById} = ${user.id}`];
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
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
