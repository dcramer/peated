import { db } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { getDefaultCollection } from "@peated/server/lib/db";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "../trpc";

export default authedProcedure
  .input(
    CollectionBottleInputSchema.extend({
      collection: z.union([z.number(), z.literal("default")]),
      user: z.union([z.literal("me"), z.number(), z.string()]),
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
