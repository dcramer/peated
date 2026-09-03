import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  externalSites,
} from "@peated/server/db/schema";
import { loadScoredExternalReviews } from "@peated/server/externalReviews/scoredReviews";
import { loadReviewScoringSettings } from "@peated/server/externalReviews/scoringSettings";
import { aggregateBottleActivityStatsInTransaction } from "@peated/server/lib/recomputeBottleActivityStats";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  BottleSchema,
  ExternalReviewScoreContributionSchema,
  ExternalReviewScoringPolicySchema,
  ExternalSiteKeySchema,
  NativeScoreSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import {
  and,
  asc,
  countDistinct,
  eq,
  getTableColumns,
  isNull,
} from "drizzle-orm";
import { z } from "zod";

const SummarySchema = z.object({
  median: z.number().nullable(),
  count: z.number().int(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/admin/external-sites/{site}/review-scoring/preview",
    summary: "Preview how review scores will count",
    description:
      "Preview sample reviews and before/after scores for up to ten active bottles without saving changes. Requires moderator privileges.",
    operationId: "previewExternalReviewScoring",
  })
  .input(
    z
      .object({
        site: ExternalSiteKeySchema,
        policy: ExternalReviewScoringPolicySchema,
      })
      .strict(),
  )
  .output(
    z.object({
      version: z.number().int(),
      totalBottles: z.number().int(),
      samples: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          url: z.string(),
          nativeScore: NativeScoreSchema.nullable(),
          before: ExternalReviewScoreContributionSchema,
          after: ExternalReviewScoreContributionSchema,
          contribution: ExternalReviewScoreContributionSchema,
        }),
      ),
      bottles: z.array(
        z.object({
          bottle: BottleSchema,
          before: SummarySchema,
          after: SummarySchema,
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const result = await db.transaction(async (tx) => {
      const [site] = await tx
        .select()
        .from(externalSites)
        .where(eq(externalSites.type, input.site))
        .for("share");
      if (!site) throw errors.NOT_FOUND({ message: "Site not found." });
      const publication = await tx.query.externalReviewPublications.findFirst({
        where: eq(externalReviewPublications.externalSiteId, site.id),
      });
      if (!publication && !isExternalReviewSiteKey(site.type))
        throw errors.NOT_FOUND({ message: "Review source not found." });
      const settings = (await loadReviewScoringSettings([site.id], tx)).get(
        site.id,
      );
      const before = await loadScoredExternalReviews(
        { siteId: site.id, limit: 20 },
        tx,
      );
      const after = await loadScoredExternalReviews(
        { reviewIds: before.map((row) => row.id) },
        tx,
        { siteId: site.id, policy: input.policy },
      );
      const afterById = new Map(after.map((row) => [row.id, row]));
      const affectedWhere = and(
        eq(externalReviewArticles.externalSiteId, site.id),
        isNull(bottleTombstones.bottleId),
      );
      const affectedQuery = () =>
        tx
          .selectDistinct(getTableColumns(bottles))
          .from(externalReviews)
          .innerJoin(
            externalReviewArticles,
            eq(externalReviewArticles.id, externalReviews.articleId),
          )
          .innerJoin(bottles, eq(bottles.id, externalReviews.bottleId))
          .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
          .where(affectedWhere);
      const affected = await affectedQuery().orderBy(asc(bottles.id)).limit(10);
      const [total] = await tx
        .select({ count: countDistinct(externalReviews.bottleId) })
        .from(externalReviews)
        .innerJoin(
          externalReviewArticles,
          eq(externalReviewArticles.id, externalReviews.articleId),
        )
        .leftJoin(
          bottleTombstones,
          eq(bottleTombstones.bottleId, externalReviews.bottleId),
        )
        .where(affectedWhere);
      const bottleResults = [];
      for (const bottle of affected) {
        const oldStats = await aggregateBottleActivityStatsInTransaction(tx, [
          bottle.id,
        ]);
        const newStats = await aggregateBottleActivityStatsInTransaction(
          tx,
          [bottle.id],
          { siteId: site.id, policy: input.policy },
        );
        bottleResults.push({
          bottle,
          before: {
            median: oldStats.medianScore,
            count: oldStats.memberScoreCount + oldStats.externalScoreCount,
          },
          after: {
            median: newStats.medianScore,
            count: newStats.memberScoreCount + newStats.externalScoreCount,
          },
        });
      }
      return {
        version: settings?.version ?? 0,
        totalBottles: total.count,
        bottles: bottleResults,
        samples: before.map((row) => ({
          id: row.id,
          name: row.name,
          url: row.url,
          nativeScore: row.nativeScore,
          before: row.conversion,
          after: afterById.get(row.id)!.conversion,
          contribution: afterById.get(row.id)!.contribution,
        })),
      };
    });
    const serialized = await serialize(
      BottleSerializer,
      result.bottles.map((row) => row.bottle),
      undefined,
      undefined,
      { includeGroupSummary: true },
    );
    return {
      ...result,
      bottles: result.bottles.map((row, index) => ({
        ...row,
        bottle: serialized[index],
      })),
    };
  });
