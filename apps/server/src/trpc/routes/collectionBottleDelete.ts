import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { getUserFromId } from "../../lib/api";
import { getDefaultCollection } from "../../lib/db";

export default authedProcedure
  .input(
    z.object({
      collection: z.union([z.number(), z.literal("default")]),
      user: z.union([z.literal("me"), z.number(), z.string()]),
      bottle: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const user = await getUserFromId(db, input.user, ctx.user);
    if (!user) {
      throw new TRPCError({
        message: "User not found.",
        code: "NOT_FOUND",
      });
    }

    if (user.id !== ctx.user.id) {
      throw new TRPCError({
        message: "Cannot modify another user's collection.",
        code: "FORBIDDEN",
      });
    }

    const collection =
      input.collection === "default"
        ? await getDefaultCollection(db, ctx.user.id)
        : await db.query.collections.findFirst({
            where: (collections, { eq }) =>
              eq(collections.id, input.collection as number),
          });

    if (!collection) {
      throw new TRPCError({
        message: "Collection not found.",
        code: "NOT_FOUND",
      });
    }

    if (ctx.user.id !== collection.createdById) {
      throw new TRPCError({
        message: "Cannot modify another user's collection.",
        code: "FORBIDDEN",
      });
    }

    await db
      .delete(collectionBottles)
      .where(
        and(
          eq(collectionBottles.bottleId, input.bottle),
          eq(collectionBottles.collectionId, collection.id),
        ),
      );

    return {};
  });
