import { db } from "@peated/server/db";
import { bottles, externalSites, storePrices } from "@peated/server/db/schema";
import { currentStorePriceCondition } from "@peated/server/lib/storePriceValidity";
import { procedure } from "@peated/server/orpc";
import { ExternalSiteSchema, StorePriceSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";

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

    const baseWhere: (SQL<unknown> | undefined)[] = [
      eq(storePrices.hidden, false),
      eq(storePrices.bottleId, bottle.id),
    ];

    if (input.onlyValid) {
      baseWhere.push(currentStorePriceCondition());
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
      .where(and(...baseWhere))
      .orderBy(desc(currentStorePriceCondition()), asc(storePrices.name));

    return {
      results: await serialize(
        StorePriceWithSiteSerializer,
        results,
        context.user,
      ),
    };
  });
