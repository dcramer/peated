import { db } from "@peated/server/db";
import { bottles, bottleTombstones, tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  BOTTLE_RECOMMENDATION_REASON,
  BottleRecommendationsSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

const MIN_SOURCE_MEMBERS = 3;
const MIN_SHARED_MEMBERS = 2;

const activeBottleConditions = and(
  isNotNull(bottles.groupId),
  sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
);

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/recommendations",
    summary: "Get bottle recommendations",
    description:
      "Recommend bottles based on preferences from the Peated community",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleRecommendations",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      limit: z.coerce.number().gte(1).lte(12).default(6),
    }),
  )
  .output(BottleRecommendationsSchema)
  .handler(async function ({ input, context, errors }) {
    const [source] = await db
      .select({ id: bottles.id })
      .from(bottles)
      .where(and(eq(bottles.id, input.bottle), activeBottleConditions));

    if (!source) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const [{ memberCount }] = await db
      .select({
        memberCount: sql<string>`COUNT(DISTINCT ${tastings.createdById})`,
      })
      .from(tastings)
      .where(
        and(
          eq(tastings.bottleId, source.id),
          inArray(tastings.ratingBand, ["outstanding", "unicorn"]),
        ),
      );

    // This route owns its sample policy. Sparse data must not become a fallback.
    if (Number(memberCount) < MIN_SOURCE_MEMBERS) {
      return {
        reason: BOTTLE_RECOMMENDATION_REASON,
        results: [],
      };
    }

    const sourceRatings = alias(tastings, "source_ratings");
    const candidateRatings = alias(tastings, "candidate_ratings");
    const overlap = sql<string>`COUNT(DISTINCT ${candidateRatings.createdById})`;
    const ranked = await db
      .select({ bottleId: candidateRatings.bottleId, overlap })
      .from(sourceRatings)
      .innerJoin(
        candidateRatings,
        eq(candidateRatings.createdById, sourceRatings.createdById),
      )
      .innerJoin(bottles, eq(bottles.id, candidateRatings.bottleId))
      .where(
        and(
          eq(sourceRatings.bottleId, source.id),
          inArray(sourceRatings.ratingBand, ["outstanding", "unicorn"]),
          inArray(candidateRatings.ratingBand, ["outstanding", "unicorn"]),
          ne(candidateRatings.bottleId, source.id),
          activeBottleConditions,
        ),
      )
      .groupBy(candidateRatings.bottleId)
      .having(sql`${overlap} >= ${MIN_SHARED_MEMBERS}`)
      .orderBy(desc(overlap), asc(candidateRatings.bottleId))
      .limit(input.limit);

    if (!ranked.length) {
      return {
        reason: BOTTLE_RECOMMENDATION_REASON,
        results: [],
      };
    }

    const resultById = new Map(
      (
        await db
          .select()
          .from(bottles)
          .where(
            inArray(
              bottles.id,
              ranked.map(({ bottleId }) => bottleId),
            ),
          )
      ).map((bottle) => [bottle.id, bottle] as const),
    );
    const results = ranked.map(({ bottleId }) => {
      const bottle = resultById.get(bottleId);
      if (!bottle) {
        throw new Error(`Ranked Bottle ${bottleId} was not found.`);
      }
      return bottle;
    });

    return {
      reason: BOTTLE_RECOMMENDATION_REASON,
      results: await serialize(BottleSerializer, results, context.user, [
        "description",
        "tastingNotes",
      ]),
    };
  });
