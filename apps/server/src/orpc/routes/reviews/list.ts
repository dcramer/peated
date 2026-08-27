import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSites,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { logWarn } from "@peated/server/lib/log";
import { implement } from "@peated/server/orpc";
import reviewListContract from "@peated/server/orpc/contracts/reviews/list";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
export default implement(reviewListContract).handler(async function ({
  input: { cursor, query, limit, sort, ...input },
  context,
  errors,
}) {
  const hasPublicScope = input.bottle !== undefined || sort === "recent";
  const requiresModerator = input.onlyUnknown || !hasPublicScope;
  // This route owns review visibility. Public Bottle and recent queries
  // exclude staged reviews. Moderator queries include them for review and matching.
  const baseWhere: (SQL<unknown> | undefined)[] = requiresModerator
    ? []
    : [eq(reviews.hidden, false)];
  const identityWhere: SQL<unknown>[] = [];

  if (input.site) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }
    baseWhere.push(eq(reviewArticles.externalSiteId, site.id));
  }

  if (hasPublicScope) {
    // No-fetch migration articles have no content hash and preserve their
    // legacy visibility. Newly fetched articles require automatic mode.
    baseWhere.push(
      or(
        isNull(reviewArticles.contentHash),
        eq(externalReviewSourcePolicies.publicationMode, "automatic"),
      ),
    );
  }

  if (sort === "recent") {
    baseWhere.push(
      isNotNull(reviews.bottleId),
      isNotNull(reviewArticles.publishedAt),
    );
  }

  if (requiresModerator && !context.user?.admin && !context.user?.mod) {
    logWarn("User requested review list without moderator permissions", {
      extra: {
        userId: context.user?.id,
      },
    });
    throw errors.BAD_REQUEST({
      message: "Must be a moderator to list all reviews.",
    });
  }

  if (input.onlyUnknown) {
    identityWhere.push(isNull(reviews.bottleId));
  }

  if (input.bottle !== undefined) {
    identityWhere.push(eq(reviews.bottleId, input.bottle));
  }

  const offset = (cursor - 1) * limit;
  if (query) {
    baseWhere.push(ilike(reviews.name, `%${query}%`));
  }

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
    .where(and(...baseWhere, ...identityWhere))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(
      ...(sort === "recent"
        ? [desc(reviewArticles.publishedAt), desc(reviews.id)]
        : [asc(reviews.name), asc(reviews.id)]),
    );
  const results = rows.map(({ review }) => review);

  return {
    results: await serialize(
      ReviewSerializer,
      results.slice(0, limit),
      context.user,
      input.site && sort !== "recent" ? ["site"] : [],
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
