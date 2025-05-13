import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { db } from "../../db";
import {
  bottleTombstones,
  bottles,
  storePrices,
  tastings,
} from "../../db/schema";
import { serialize } from "../../serializers";
import { BottleSerializer } from "../../serializers/bottle";

export default publicProcedure.input(z.number()).query(async function ({
  input,
  ctx,
}) {
  let [bottle] = await db.select().from(bottles).where(eq(bottles.id, input));

  if (!bottle) {
    // check for a tommbstone
    [bottle] = await db
      .select({
        ...getTableColumns(bottles),
      })
      .from(bottleTombstones)
      .innerJoin(bottles, eq(bottleTombstones.newBottleId, bottles.id))
      .where(eq(bottleTombstones.bottleId, input));
    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }
  }

  const createdBy = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.id, bottle.createdById),
  });

  const [lastPrice] = await db
    .select()
    .from(storePrices)
    .where(and(eq(storePrices.bottleId, bottle.id)))
    .orderBy(desc(storePrices.updatedAt))
    .limit(1);

  const [{ count: totalPeople }] = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${tastings.createdById})`,
    })
    .from(tastings)
    .where(eq(tastings.bottleId, bottle.id));

  return {
    ...(await serialize(BottleSerializer, bottle, ctx.user)),
    createdBy: createdBy
      ? await serialize(UserSerializer, createdBy, ctx.user)
      : null,
    people: totalPeople,
    lastPrice: lastPrice
      ? await serialize(StorePriceSerializer, lastPrice, ctx.user)
      : null,
  };
});
