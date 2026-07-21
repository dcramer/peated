import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  storePrices,
  tastings,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import loadBottlePriceTargetId, {
  legacyStorePriceBottleMembership,
} from "@peated/server/orpc/routes/bottles/prices/load-target";
import { recordStorePriceReadParity } from "@peated/server/orpc/routes/prices/read-parity";
import {
  BottleSchema,
  StorePriceSchema,
  detailsResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";

// Compose details as Bottle schema + extra fields to allow OpenAPI $ref via allOf
const OutputSchema = z.intersection(
  BottleSchema,
  z.object({
    people: z.number(),
    lastPrice: StorePriceSchema.nullable(),
  }),
);

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}",
    summary: "Get bottle details",
    description:
      "Retrieve detailed information about a specific bottle including pricing and tasting statistics",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottle",
    }),
  })
  .input(z.object({ bottle: z.coerce.number() }))
  // TODO(response-envelope): switch to wrapping the details payload as
  // { data: ... } by updating detailsResponse() when we migrate envelopes.
  .output(detailsResponse(OutputSchema))
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

    const targetId = await loadBottlePriceTargetId(bottle.id);
    const targetWhere = eq(storePrices.targetId, targetId);
    const legacyWhere = legacyStorePriceBottleMembership(bottle.id);

    const [lastPrice] = await db
      .select({
        ...getTableColumns(storePrices),
        targetMatches: sql<boolean>`COALESCE(${targetWhere}, false)`,
        legacyMatches: sql<boolean>`COALESCE(${legacyWhere}, false)`,
      })
      .from(storePrices)
      .where(targetWhere)
      .orderBy(desc(storePrices.updatedAt), desc(storePrices.id))
      .limit(1);
    const [legacyTopPrice] = await db
      .select({
        id: storePrices.id,
        targetId: storePrices.targetId,
        bottleId: storePrices.bottleId,
        releaseId: storePrices.releaseId,
        targetMatches: sql<boolean>`COALESCE(${targetWhere}, false)`,
        legacyMatches: sql<boolean>`COALESCE(${legacyWhere}, false)`,
      })
      .from(storePrices)
      .where(legacyWhere)
      .orderBy(desc(storePrices.updatedAt), desc(storePrices.id))
      .limit(1);
    const priceParityCandidates = [
      ...new Map(
        [lastPrice, legacyTopPrice].flatMap((price) =>
          price ? [[price.id, price] as const] : [],
        ),
      ).values(),
    ];
    await recordStorePriceReadParity(
      priceParityCandidates,
      { caller: "bottles.details", operation: "lastPriceFilter" },
      "catalog_reference",
    );

    const [{ count: totalPeople }] = await db
      .select({
        count: sql<string>`COUNT(DISTINCT ${tastings.createdById})`,
      })
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));

    return {
      ...(await serialize(BottleSerializer, bottle, context.user)),
      people: Number(totalPeople),
      lastPrice: lastPrice
        ? await serialize(StorePriceSerializer, lastPrice, context.user)
        : null,
    };
  });
