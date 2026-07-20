import { db } from "@peated/server/db";
import { externalSites, reviews } from "@peated/server/db/schema";
import { recordCatalogTargetReadFilterParity } from "@peated/server/lib/catalogTargetReadParity";
import { resolveLegacyCatalogTargetFilterForRead } from "@peated/server/lib/catalogTargets";
import { logWarn } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import {
  ExternalSiteTypeEnum,
  ReviewSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    site: ExternalSiteTypeEnum.optional(),
    bottle: z.coerce.number().gte(1).optional(),
    release: z.coerce.number().gte(1).optional(),
    query: z.string().default(""),
    onlyUnknown: z.coerce.boolean().optional(),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(100),
  })
  .default({
    query: "",
    cursor: 1,
    limit: 100,
  });

export default procedure
  .route({
    method: "GET",
    path: "/reviews",
    summary: "List reviews",
    description:
      "Retrieve reviews with filtering by site, bottle, and unknown status. Requires moderator privileges for full access",
    operationId: "listReviews",
  })
  .input(InputSchema)
  // TODO(response-envelope): use helper to enable later switch to { data, meta }
  .output(listResponse(ReviewSchema))
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    context,
    errors,
  }) {
    const baseWhere: (SQL<unknown> | undefined)[] = [eq(reviews.hidden, false)];
    const targetWhere: SQL<unknown>[] = [];
    const parityFilters: {
      filter: "catalog_reference" | "only_unknown";
      targetWhere: SQL<unknown>;
      legacyWhere: SQL<unknown>;
    }[] = [];

    if (input.site) {
      const site = await db.query.externalSites.findFirst({
        where: eq(externalSites.type, input.site),
      });

      if (!site) {
        throw errors.NOT_FOUND({
          message: "Site not found.",
        });
      }
      baseWhere.push(eq(reviews.externalSiteId, site.id));
    }

    const hasPublicScope =
      input.bottle !== undefined || input.release !== undefined;
    const requiresModerator = input.onlyUnknown || !hasPublicScope;

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
      const authoritativeWhere = isNull(reviews.targetId);
      const legacyWhere = isNull(reviews.bottleId);
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "only_unknown",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }

    if (input.bottle || input.release) {
      const target = await resolveLegacyCatalogTargetFilterForRead(
        {
          bottleId: input.bottle,
          releaseId: input.release,
        },
        { caller: "reviews.list", operation: "filter" },
      );
      const authoritativeWhere = target
        ? eq(reviews.targetId, target.targetId)
        : sql`false`;
      const legacyWhere = and(
        input.bottle === undefined
          ? undefined
          : eq(reviews.bottleId, input.bottle),
        input.release === undefined
          ? undefined
          : eq(reviews.releaseId, input.release),
      )!;
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "catalog_reference",
        targetWhere: authoritativeWhere,
        legacyWhere,
      });
    }

    const offset = (cursor - 1) * limit;
    if (query) {
      baseWhere.push(ilike(reviews.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(reviews)
      .where(and(...baseWhere, ...targetWhere))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(reviews.name));

    await Promise.all(
      parityFilters.map(async (parityFilter) => {
        const candidates = await db
          .select({
            id: reviews.id,
            targetId: reviews.targetId,
            bottleId: reviews.bottleId,
            releaseId: reviews.releaseId,
            targetMatches: sql<boolean>`COALESCE(${parityFilter.targetWhere}, false)`,
            legacyMatches: sql<boolean>`COALESCE(${parityFilter.legacyWhere}, false)`,
          })
          .from(reviews)
          .where(
            and(
              ...baseWhere,
              or(parityFilter.targetWhere, parityFilter.legacyWhere),
            ),
          )
          .limit(limit + 1)
          .offset(offset)
          .orderBy(asc(reviews.name));

        recordCatalogTargetReadFilterParity(
          candidates.map((candidate) => ({
            consumerTable: "review",
            rowLocator: { id: candidate.id },
            targetId: candidate.targetId,
            legacy: {
              bottleId: candidate.bottleId,
              releaseId: candidate.releaseId,
            },
            filter: parityFilter.filter,
            targetMatches: candidate.targetMatches,
            legacyMatches: candidate.legacyMatches,
          })),
          { caller: "reviews.list", operation: "filter" },
        );
      }),
    );

    return {
      results: await serialize(
        ReviewSerializer,
        results.slice(0, limit),
        context.user,
        [...(input.site ? ["site"] : []), ...(input.bottle ? ["bottle"] : [])],
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
