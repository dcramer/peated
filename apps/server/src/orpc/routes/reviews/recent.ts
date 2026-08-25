import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { publicReviewVisibility } from "./publicVisibility";

const InputSchema = z
  .object({
    limit: z.coerce.number().gte(1).lte(24).default(12),
  })
  .strict()
  .default({ limit: 12 });

export default procedure
  .route({
    method: "GET",
    path: "/reviews/recent",
    summary: "List recent public reviews",
    description: "List recent matched reviews that can appear publicly",
    operationId: "listRecentReviews",
  })
  .input(InputSchema)
  .output(z.object({ results: z.array(ReviewSchema) }))
  .handler(async function ({ input, context }) {
    const rows = await db
      .select({ review: reviews })
      .from(reviews)
      .innerJoin(reviewArticles, eq(reviews.articleId, reviewArticles.id))
      .leftJoin(
        externalReviewSourcePolicies,
        eq(
          reviewArticles.externalSiteId,
          externalReviewSourcePolicies.externalSiteId,
        ),
      )
      .where(and(isNotNull(reviews.bottleId), ...publicReviewVisibility()))
      .orderBy(
        sql`${reviewArticles.publishedAt} DESC NULLS LAST`,
        desc(reviews.createdAt),
        desc(reviews.id),
      )
      .limit(input.limit);

    return {
      results: await serialize(
        ReviewSerializer,
        rows.map(({ review }) => review),
        context.user,
      ),
    };
  });
