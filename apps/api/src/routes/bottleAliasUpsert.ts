import { db } from "@peated/server/db";
import type { BottleAlias } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { BottleAliasSchema } from "@peated/server/schemas";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { modProcedure } from "../trpc";

export default modProcedure.input(BottleAliasSchema).mutation(async function ({
  input,
  ctx,
}) {
  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, input.bottle));

  if (!bottle) {
    throw new TRPCError({
      message: "Bottle not found.",
      code: "NOT_FOUND",
    });
  }

  const [newAlias, isNew] = await db.transaction(async (tx) => {
    const existingAlias = await tx.query.bottleAliases.findFirst({
      where: eq(sql`LOWER(${bottleAliases.name})`, input.name.toLowerCase()),
    });
    let newAlias: BottleAlias | undefined = undefined;
    let isNew = false;
    if (existingAlias?.bottleId === input.bottle) {
      if (existingAlias.name !== input.name) {
        // case change
        [newAlias] = await tx
          .update(bottleAliases)
          .set({ name: input.name })
          .where(eq(bottleAliases.name, existingAlias.name))
          .returning();
      }
      // we're good - likely renaming to an alias that already existed
    } else if (!existingAlias) {
      [newAlias] = await tx
        .insert(bottleAliases)
        .values({
          name: input.name,
          bottleId: input.bottle,
        })
        .returning();
      isNew = true;
    } else if (!existingAlias.bottleId) {
      [newAlias] = await tx
        .update(bottleAliases)
        .set({
          bottleId: input.bottle,
        })
        .where(and(eq(bottleAliases.name, existingAlias.name)))
        .returning();
    } else {
      throw new Error(
        `Duplicate alias found (${existingAlias.bottleId}). Not implemented.`,
      );
    }

    const [price] = await tx
      .update(storePrices)
      .set({
        bottleId: input.bottle,
      })
      .where(eq(sql`LOWER(${storePrices.name})`, input.name.toLowerCase()))
      .returning();

    if (price?.imageUrl && input.bottle) {
      // determine if we've got an image we can use
      const [bottle] = await tx
        .select()
        .from(bottles)
        .where(eq(bottles.id, input.bottle));

      if (bottle && !bottle.imageUrl) {
        await tx
          .update(bottles)
          .set({
            imageUrl: price.imageUrl,
          })
          .where(eq(bottles.id, input.bottle));
      }
    }

    await tx
      .update(reviews)
      .set({
        bottleId: input.bottle,
      })
      .where(eq(sql`LOWER(${reviews.name})`, input.name.toLowerCase()));

    return [newAlias, isNew];
  });

  if (!newAlias) {
    throw new TRPCError({
      message: "Failed to save alias.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  if (isNew) {
    try {
      await pushJob("OnBottleAliasChange", { name: newAlias.name });
    } catch (err) {
      logError(err, {
        bottle: {
          id: input.bottle,
        },
      });
    }
  }

  if (newAlias.bottleId) {
    await pushUniqueJob("IndexBottleSearchVectors", {
      bottleId: newAlias.bottleId,
    });
  }

  return {};
});
