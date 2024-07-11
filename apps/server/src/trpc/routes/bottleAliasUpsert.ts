import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { BottleAliasSchema } from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { modProcedure } from "..";

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

  const newAlias = await db.transaction(async (tx) => {
    const existingAlias = await tx.query.bottleAliases.findFirst({
      where: eq(sql`LOWER(${bottleAliases.name})`, input.name.toLowerCase()),
    });
    if (existingAlias?.bottleId === input.bottle) {
      if (existingAlias.name !== input.name) {
        // case change
        await tx
          .update(bottleAliases)
          .set({ name: input.name })
          .where(eq(bottleAliases.name, existingAlias.name));
      }
      // we're good - likely renaming to an alias that already existed
    } else if (!existingAlias) {
      await tx.insert(bottleAliases).values({
        name: input.name,
        bottleId: input.bottle,
      });
      return input.name;
    } else if (!existingAlias.bottleId) {
      await tx
        .update(bottleAliases)
        .set({
          bottleId: input.bottle,
        })
        .where(and(eq(bottleAliases.name, existingAlias.name)));
    } else {
      throw new Error(
        `Duplicate alias found (${existingAlias.bottleId}). Not implemented.`,
      );
    }

    await tx
      .update(storePrices)
      .set({
        bottleId: input.bottle,
      })
      .where(eq(sql`LOWER(${storePrices.name})`, input.name.toLowerCase()));

    await tx
      .update(reviews)
      .set({
        bottleId: input.bottle,
      })
      .where(eq(sql`LOWER(${reviews.name})`, input.name.toLowerCase()));
  });

  if (newAlias) {
    try {
      pushJob("OnBottleAliasChange", { name: newAlias });
    } catch (err) {
      logError(err, {
        bottle: {
          id: input.bottle,
        },
      });
    }
  }

  return {};
});
