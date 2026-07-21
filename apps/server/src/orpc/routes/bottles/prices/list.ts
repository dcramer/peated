import { db } from "@peated/server/db";
import { bottles, externalSites, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { recordStorePriceReadParity } from "@peated/server/orpc/routes/prices/read-parity";
import { ExternalSiteSchema, StorePriceSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import loadBottlePriceTargetId, {
  legacyStorePriceBottleMembership,
} from "./load-target";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/prices",
    summary: "List bottle prices",
    description:
      "Retrieve current and historical prices for a specific bottle from various external sites",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottlePrices",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      onlyValid: z.coerce.boolean().optional(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        StorePriceSchema.extend({
          site: ExternalSiteSchema,
        }),
      ),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const targetId = await loadBottlePriceTargetId(bottle.id);

    const baseWhere: (SQL<unknown> | undefined)[] = [
      eq(storePrices.hidden, false),
    ];
    const targetWhere = eq(storePrices.targetId, targetId);
    const legacyWhere = legacyStorePriceBottleMembership(bottle.id);

    if (input.onlyValid) {
      baseWhere.push(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`);
    }

    const results = await db
      .select({
        ...getTableColumns(storePrices),
        externalSite: externalSites,
      })
      .from(storePrices)
      .innerJoin(
        externalSites,
        eq(storePrices.externalSiteId, externalSites.id),
      )
      .where(and(...baseWhere, targetWhere))
      .orderBy(
        desc(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`),
        asc(storePrices.name),
      );

    const parityCandidates = await db
      .select({
        id: storePrices.id,
        targetId: storePrices.targetId,
        bottleId: storePrices.bottleId,
        releaseId: storePrices.releaseId,
        targetMatches: sql<boolean>`COALESCE(${targetWhere}, false)`,
        legacyMatches: sql<boolean>`COALESCE(${legacyWhere}, false)`,
      })
      .from(storePrices)
      .where(and(...baseWhere, or(targetWhere, legacyWhere)))
      .orderBy(
        desc(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`),
        asc(storePrices.name),
      );
    await recordStorePriceReadParity(
      parityCandidates,
      { caller: "bottles.prices.list", operation: "filter" },
      "catalog_reference",
    );

    return {
      results: await serialize(
        StorePriceWithSiteSerializer,
        results,
        context.user,
      ),
    };
  });
