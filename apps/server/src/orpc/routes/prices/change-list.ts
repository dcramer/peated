import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { listResponse, PriceChangeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { PriceChangeSerializer } from "@peated/server/serializers/storePrice";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { recordStorePriceReadParity } from "./read-parity";

const InputSchema = z
  .object({
    query: z.string().default(""),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(100),
  })
  .default({
    query: "",
    cursor: 1,
    limit: 100,
  });

const OutputSchema = listResponse(PriceChangeSchema);

export default procedure
  .route({
    method: "GET",
    path: "/price-changes",
    summary: "List price changes",
    description:
      "Retrieve significant price changes for exact Bottle or generic BottleGroup catalog targets from the past week with search and pagination support",
    operationId: "listPriceChanges",
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input: { query, cursor, limit }, context }) {
    const offset = (cursor - 1) * limit;

    const minChange = 500; // $5

    const targetWhere = isNotNull(storePrices.targetId);
    const legacyWhere = isNotNull(storePrices.bottleId);
    const baseWhere: SQL[] = [
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
      sql`${storePriceHistories.date} < DATE(${storePrices.updatedAt})`,
      sql`${storePriceHistories.date} > NOW() - interval '4 week'`,
    ];
    if (query) {
      baseWhere.push(ilike(storePrices.name, `%${query}%`));
    }

    const results = await db
      .select({
        id: sql<string>`${storePrices.targetId}`,
        price: sql<string>`AVG(${storePrices.price})`,
        previousPrice: sql<string>`AVG(${storePriceHistories.price})`,
        // assume this never changes
        currency: storePrices.currency,
      })
      .from(storePrices)
      .innerJoin(
        storePriceHistories,
        eq(storePriceHistories.priceId, storePrices.id),
      )
      .where(and(...baseWhere, targetWhere))
      .groupBy(storePrices.targetId, storePrices.currency)
      .having(
        sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) > ${minChange}`,
      )
      .orderBy(
        sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) DESC`,
      )
      .limit(limit + 1)
      .offset(offset);

    const pageResults = results.slice(0, limit);
    const pageTargetIds = pageResults.map(({ id }) => Number(id));
    const pageTargetWhere = inArray(storePrices.targetId, pageTargetIds);
    const parityCandidates = pageTargetIds.length
      ? await db
          .selectDistinct({
            id: storePrices.id,
            targetId: storePrices.targetId,
            bottleId: storePrices.bottleId,
            releaseId: storePrices.releaseId,
            targetMatches: sql<boolean>`COALESCE(${pageTargetWhere}, false)`,
            legacyMatches: sql<boolean>`COALESCE(${legacyWhere}, false)`,
          })
          .from(storePrices)
          .innerJoin(
            storePriceHistories,
            eq(storePriceHistories.priceId, storePrices.id),
          )
          .where(and(...baseWhere, pageTargetWhere))
          .orderBy(asc(storePrices.id))
          // Bound telemetry query cost; this parity sample is intentionally non-exhaustive.
          .limit(Math.min(pageTargetIds.length * 10, 1_000))
      : [];
    await recordStorePriceReadParity(
      parityCandidates,
      { caller: "prices.changeList", operation: "filter" },
      "assigned",
    );

    return {
      results: await serialize(
        PriceChangeSerializer,
        pageResults,
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
