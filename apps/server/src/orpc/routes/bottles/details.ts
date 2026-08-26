import { implement } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import { db } from "@peated/server/db";
import {
  bottleBarcodes,
  bottleTombstones,
  bottles,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import type { Context } from "@peated/server/orpc/context";
import bottleDetailsContract from "@peated/server/orpc/contracts/bottles/details";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";

export default implement(bottleDetailsContract)
  .$context<Context>()
  .use(sentryMiddleware())
  .handler(async function ({ input, context, errors }) {
    const { bottle: bottleId } = input;

    let [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleId));

    if (!bottle) {
      // check for a tombstone
      [bottle] = await db
        .select({
          ...getTableColumns(bottles),
        })
        .from(bottleTombstones)
        .innerJoin(bottles, eq(bottleTombstones.newBottleId, bottles.id))
        .where(eq(bottleTombstones.bottleId, bottleId));
      if (!bottle) {
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
        });
      }
    }

    const [[lastPrice], [{ count: totalPeople }], barcodeList] =
      await Promise.all([
        db
          .select()
          .from(storePrices)
          .where(
            and(
              eq(storePrices.bottleId, bottle.id),
              eq(storePrices.hidden, false),
            ),
          )
          .orderBy(desc(storePrices.updatedAt), desc(storePrices.id))
          .limit(1),
        db
          .select({
            count: sql<string>`COUNT(DISTINCT ${tastings.createdById})`,
          })
          .from(tastings)
          .where(eq(tastings.bottleId, bottle.id)),
        db
          .select()
          .from(bottleBarcodes)
          .where(eq(bottleBarcodes.bottleId, bottle.id))
          .orderBy(asc(bottleBarcodes.value), asc(bottleBarcodes.id)),
      ]);

    return {
      ...(await serialize(BottleSerializer, bottle, context.user, [], {
        includeGroupSummary: true,
      })),
      barcodes: barcodeList.map(({ value, volume }) => ({ value, volume })),
      people: Number(totalPeople),
      lastPrice: lastPrice
        ? await serialize(StorePriceSerializer, lastPrice, context.user)
        : null,
    };
  });
