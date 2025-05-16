import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  BottleSchema,
  StorePriceSchema,
  UserSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { UserSerializer } from "@peated/server/serializers/user";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = BottleSchema.extend({
  createdBy: UserSchema.nullable(),
  people: z.number(),
  lastPrice: StorePriceSchema.nullable(),
});

export default procedure
  .route({ method: "GET", path: "/bottles/:id" })
  .input(z.coerce.number())
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    let [bottle] = await db.select().from(bottles).where(eq(bottles.id, input));

    if (!bottle) {
      // check for a tombstone
      [bottle] = await db
        .select({
          ...getTableColumns(bottles),
        })
        .from(bottleTombstones)
        .innerJoin(bottles, eq(bottleTombstones.newBottleId, bottles.id))
        .where(eq(bottleTombstones.bottleId, input));
      if (!bottle) {
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
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
        count: sql<string>`COUNT(DISTINCT ${tastings.createdById})`,
      })
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));

    return {
      ...(await serialize(BottleSerializer, bottle, context.user)),
      createdBy: createdBy
        ? await serialize(UserSerializer, createdBy, context.user)
        : null,
      people: Number(totalPeople),
      lastPrice: lastPrice
        ? await serialize(StorePriceSerializer, lastPrice, context.user)
        : null,
    };
  });
