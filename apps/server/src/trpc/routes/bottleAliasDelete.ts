import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import { BottleAliasSchema } from "@peated/server/schemas";
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

  const [bottleAlias] = await db
    .select({
      name: bottleAliases.name,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(bottleAliases.bottleId, input.bottle),
        eq(bottleAliases.name, input.name),
      ),
    );

  if (!bottleAlias) {
    throw new TRPCError({
      message: "Bottle Alias not found.",
      code: "NOT_FOUND",
    });
  }

  const canonicalName = `${bottle.fullName}${bottle.vintageYear ? ` (${bottle.vintageYear})` : ""}`;
  if (bottleAlias.name === canonicalName)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot delete canonical name",
    });

  await db.transaction(async (tx) => {
    // clear any pinned matches as they are/were likely wrong
    await Promise.all([
      tx
        .update(storePrices)
        .set({
          bottleId: null,
        })
        .where(
          eq(sql`LOWER(${storePrices.name})`, bottleAlias.name.toLowerCase()),
        ),
      tx
        .update(reviews)
        .set({
          bottleId: null,
        })
        .where(eq(sql`LOWER(${reviews.name})`, bottleAlias.name.toLowerCase())),
      tx
        .delete(bottleAliases)
        .where(
          and(
            eq(bottleAliases.bottleId, input.bottle),
            eq(bottleAliases.name, input.name),
          ),
        ),
    ]);
  });

  return {};
});
