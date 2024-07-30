import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import { formatBottleName } from "@peated/server/lib/format";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

export default modProcedure.input(z.string()).mutation(async function ({
  input,
  ctx,
}) {
  const alias = await db.query.bottleAliases.findFirst({
    where: eq(sql`LOWER(${bottleAliases.name})`, input.toLowerCase()),
    with: {
      bottle: true,
    },
  });

  if (!alias) {
    throw new TRPCError({
      message: "Bottle Alias not found.",
      code: "NOT_FOUND",
    });
  }

  if (alias.bottle) {
    const { bottle } = alias;
    const canonicalName = formatBottleName(bottle);
    if (alias.name.toLowerCase() === canonicalName.toLowerCase())
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete canonical name",
      });
  }

  await db.transaction(async (tx) => {
    // clear any pinned matches as they are/were likely wrong
    await Promise.all([
      tx
        .update(storePrices)
        .set({
          bottleId: null,
        })
        .where(eq(sql`LOWER(${storePrices.name})`, alias.name.toLowerCase())),
      tx
        .update(reviews)
        .set({
          bottleId: null,
        })
        .where(eq(sql`LOWER(${reviews.name})`, alias.name.toLowerCase())),
      tx.delete(bottleAliases).where(eq(bottleAliases.name, alias.name)),
    ]);
  });

  return {};
});
