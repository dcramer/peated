import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
  externalSites,
} from "@peated/server/db/schema";
import { visibleExternalReviewWhere } from "@peated/server/externalReviews/visibility";
import { logWarn } from "@peated/server/lib/log";
import { implement } from "@peated/server/orpc";
import externalReviewListContract from "@peated/server/orpc/contracts/externalReviews/list";
import { serialize } from "@peated/server/serializers";
import { ExternalReviewSerializer } from "@peated/server/serializers/externalReview";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, isNotNull, isNull } from "drizzle-orm";
export default implement(externalReviewListContract).handler(async function ({
  input: { cursor, query, limit, sort, ...input },
  context,
  errors,
}) {
  const hasPublicScope = input.bottle !== undefined || sort === "recent";
  const requiresModerator = input.onlyUnknown || !hasPublicScope;
  // Moderator queries include staged records for matching.
  const baseWhere: (SQL<unknown> | undefined)[] = requiresModerator
    ? []
    : [visibleExternalReviewWhere()];
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
    baseWhere.push(eq(externalReviewArticles.externalSiteId, site.id));
  }

  if (sort === "recent") {
    baseWhere.push(
      isNotNull(externalReviews.bottleId),
      isNotNull(externalReviewArticles.publishedAt),
    );
  }

  if (requiresModerator && !context.user?.admin && !context.user?.mod) {
    logWarn(
      "User requested external review list without moderator permissions",
      {
        extra: {
          userId: context.user?.id,
        },
      },
    );
    throw errors.BAD_REQUEST({
      message: "Must be a moderator to list all external reviews.",
    });
  }

  if (input.onlyUnknown) {
    identityWhere.push(isNull(externalReviews.bottleId));
  }

  if (input.bottle !== undefined) {
    identityWhere.push(eq(externalReviews.bottleId, input.bottle));
  }

  const offset = (cursor - 1) * limit;
  if (query) {
    baseWhere.push(ilike(externalReviews.name, `%${query}%`));
  }

  const rows = await db
    .select({ externalReview: externalReviews })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .leftJoin(
      externalReviewSourcePolicies,
      eq(
        externalReviewArticles.externalSiteId,
        externalReviewSourcePolicies.externalSiteId,
      ),
    )
    .where(and(...baseWhere, ...identityWhere))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(
      ...(sort === "recent"
        ? [desc(externalReviewArticles.publishedAt), desc(externalReviews.id)]
        : [asc(externalReviews.name), asc(externalReviews.id)]),
    );
  const results = rows.map(({ externalReview }) => externalReview);

  return {
    results: await serialize(
      ExternalReviewSerializer,
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
