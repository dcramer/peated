import { db } from "@peated/server/db";
import {
  bottles,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { getDefaultCollection } from "@peated/server/lib/db";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

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
        code: "UNAUTHORIZED",
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
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    if (ctx.user.id !== collection.createdById) {
      throw new TRPCError({
        message: "Cannot modify another user's collection.",
        code: "UNAUTHORIZED",
      });
    }

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));
    if (!bottle) {
      throw new TRPCError({
        message: "Cannot find bottle.",
        code: "NOT_FOUND",
      });
    }

    await db.transaction(async (tx) => {
      const [cb] = await tx
        .insert(collectionBottles)
        .values({
          collectionId: collection.id,
          bottleId: bottle.id,
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
