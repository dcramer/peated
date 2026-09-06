import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  externalSites,
} from "@peated/server/db/schema";
import { visibleExternalReviewWhere } from "@peated/server/externalReviews/visibility";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { implement } from "@peated/server/orpc";
import activeCriticsContract from "@peated/server/orpc/contracts/externalReviews/active-critics";
import { serializeExternalSite } from "@peated/server/serializers/externalSite";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

export default implement(activeCriticsContract).handler(async function ({
  input,
}) {
  const latestBySite = await db
    .selectDistinctOn([externalReviewArticles.externalSiteId], {
      bottleId: bottles.id,
      publishedAt: externalReviewArticles.publishedAt,
      reviewId: externalReviews.id,
      reviewUrl: externalReviewArticles.canonicalUrl,
      site: externalSites,
    })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .leftJoin(
      externalReviewPublications,
      eq(
        externalReviewArticles.externalSiteId,
        externalReviewPublications.externalSiteId,
      ),
    )
    .innerJoin(
      externalSites,
      eq(externalReviewArticles.externalSiteId, externalSites.id),
    )
    .innerJoin(bottles, eq(externalReviews.bottleId, bottles.id))
    .where(
      and(
        visibleExternalReviewWhere(),
        isNotNull(externalReviews.bottleId),
        isNotNull(externalReviewArticles.publishedAt),
        isNotNull(bottles.groupId),
        sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
      ),
    )
    .orderBy(
      asc(externalReviewArticles.externalSiteId),
      desc(externalReviewArticles.publishedAt),
      desc(externalReviews.id),
    );

  // The API owns the activity ranking so the product can tune it without
  // changing every surface that presents critics.
  const rankedCritics = latestBySite
    .sort(
      (first, second) =>
        (second.publishedAt?.getTime() ?? 0) -
          (first.publishedAt?.getTime() ?? 0) ||
        second.reviewId - first.reviewId,
    )
    .slice(0, input.limit);
  const rankedBottles = rankedCritics.length
    ? await db.query.bottles.findMany({
        where: inArray(
          bottles.id,
          rankedCritics.map(({ bottleId }) => bottleId),
        ),
        with: { brand: true, group: true, series: true },
      })
    : [];
  const bottlesById = new Map(
    rankedBottles.map((bottle) => [bottle.id, bottle]),
  );

  return rankedCritics.map(({ bottleId, publishedAt, reviewUrl, site }) => {
    const bottle = bottlesById.get(bottleId);
    if (!bottle) {
      throw new Error(`Active critic references missing Bottle ${bottleId}.`);
    }
    const serializedSite = serializeExternalSite(site);
    return {
      site: {
        type: serializedSite.type,
        name: serializedSite.name,
        imageUrl: serializedSite.imageUrl,
      },
      latestReview: {
        bottleName: formatBottleDisplayName(bottle),
        publishedAt: publishedAt!.toISOString(),
        url: reviewUrl,
      },
    };
  });
});
