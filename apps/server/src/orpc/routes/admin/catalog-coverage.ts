import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

const itemCoverageSchema = z.object({
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
});

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/catalog/coverage",
    summary: "Get catalog aggregation coverage",
    description:
      "Retrieve active bottle content coverage and visible external item matching coverage",
    spec: (spec) => ({
      ...spec,
      operationId: "getCatalogCoverage",
    }),
  })
  .output(
    z.object({
      bottles: z.object({
        total: z.number().int().nonnegative(),
        withDescription: z.number().int().nonnegative(),
        withImage: z.number().int().nonnegative(),
        withReviews: z.number().int().nonnegative(),
        withPriceListings: z.number().int().nonnegative(),
      }),
      externalReviews: itemCoverageSchema,
      priceListings: itemCoverageSchema,
    }),
  )
  .handler(async () => {
    const [
      [bottleContentCoverage],
      [reviewBottleCoverage],
      [priceListingBottleCoverage],
      [reviewCoverage],
      [priceListingCoverage],
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          withDescription: sql<number>`count(*) filter (where nullif(btrim(${bottles.description}), '') is not null)::int`,
          withImage: sql<number>`count(*) filter (where nullif(btrim(${bottles.imageUrl}), '') is not null)::int`,
        })
        .from(bottles)
        .where(
          and(
            isNotNull(bottles.groupId),
            sql`not exists (
                select 1 from ${bottleTombstones}
                where ${bottleTombstones.bottleId} = ${bottles.id}
              )`,
          ),
        ),
      db
        .select({
          total: sql<number>`count(distinct ${externalReviews.bottleId})::int`,
        })
        .from(externalReviews)
        .innerJoin(bottles, eq(externalReviews.bottleId, bottles.id))
        .where(
          and(
            eq(externalReviews.hidden, false),
            isNotNull(bottles.groupId),
            sql`not exists (
                select 1 from ${bottleTombstones}
                where ${bottleTombstones.bottleId} = ${bottles.id}
              )`,
          ),
        ),
      db
        .select({
          total: sql<number>`count(distinct ${storePrices.bottleId})::int`,
        })
        .from(storePrices)
        .innerJoin(bottles, eq(storePrices.bottleId, bottles.id))
        .where(
          and(
            eq(storePrices.hidden, false),
            isNotNull(bottles.groupId),
            sql`not exists (
                select 1 from ${bottleTombstones}
                where ${bottleTombstones.bottleId} = ${bottles.id}
              )`,
          ),
        ),
      db
        .select({
          total: sql<number>`count(*)::int`,
          matched: sql<number>`count(*) filter (where ${externalReviews.bottleId} is not null)::int`,
          unmatched: sql<number>`count(*) filter (where ${externalReviews.bottleId} is null)::int`,
        })
        .from(externalReviews)
        .where(eq(externalReviews.hidden, false)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          matched: sql<number>`count(*) filter (where ${storePrices.bottleId} is not null)::int`,
          unmatched: sql<number>`count(*) filter (where ${storePrices.bottleId} is null)::int`,
        })
        .from(storePrices)
        .where(eq(storePrices.hidden, false)),
    ]);

    return {
      bottles: {
        ...bottleContentCoverage!,
        withReviews: reviewBottleCoverage!.total,
        withPriceListings: priceListingBottleCoverage!.total,
      },
      externalReviews: reviewCoverage!,
      priceListings: priceListingCoverage!,
    };
  });
