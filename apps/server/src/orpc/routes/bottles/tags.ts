import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  tastings,
} from "@peated/server/db/schema";
import {
  loadCatalogTargetReadsWithParity,
  recordCatalogTargetReadFilterParity,
} from "@peated/server/lib/catalogTargetReadParity";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetByBottleId,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const TAGGED_TASTING_PARITY_LIMIT = 200;

function legacyTastingBottleMembership(bottleId: number): SQL<unknown> {
  return or(
    and(eq(tastings.bottleId, bottleId), isNull(tastings.releaseId)),
    sql<boolean>`exists(${db
      .select({ value: sql`1` })
      .from(bottleReleases)
      .innerJoin(
        bottleReleasePromotions,
        eq(bottleReleasePromotions.releaseId, bottleReleases.id),
      )
      .where(
        and(
          eq(bottleReleases.id, tastings.releaseId),
          eq(bottleReleases.bottleId, tastings.bottleId),
          eq(bottleReleasePromotions.status, "promoted"),
          eq(bottleReleasePromotions.promotedBottleId, bottleId),
        ),
      )})`,
  )!;
}

async function countTaggedTastings(
  bottleId: number,
  targetId: number,
): Promise<number> {
  const targetWhere = eq(tastings.targetId, targetId);
  const legacyWhere = legacyTastingBottleMembership(bottleId);
  const hasTags = sql<boolean>`array_length(${tastings.tags}, 1) > 0`;
  const [{ count }] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(tastings)
    .where(and(hasTags, targetWhere));

  const rows = await db
    .select({
      id: tastings.id,
      targetId: tastings.targetId,
      bottleId: tastings.bottleId,
      releaseId: tastings.releaseId,
      targetMatches: sql<boolean>`COALESCE(${targetWhere}, false)`,
      legacyMatches: sql<boolean>`COALESCE(${legacyWhere}, false)`,
    })
    .from(tastings)
    .where(and(hasTags, or(targetWhere, legacyWhere)))
    .orderBy(asc(tastings.id))
    .limit(TAGGED_TASTING_PARITY_LIMIT);

  const parityItems = rows.map((row) => ({
    consumerTable: "tasting" as const,
    rowLocator: { id: row.id },
    targetId: row.targetId,
    legacy: {
      bottleId: row.bottleId,
      releaseId: row.releaseId,
    },
  }));
  const parityContext = {
    actor: null,
    permissions: { canReadCatalogIdentity: true as const },
    caller: "bottles.tags",
    operation: "total_count",
  };
  await loadCatalogTargetReadsWithParity(parityItems, parityContext);
  recordCatalogTargetReadFilterParity(
    rows.map((row, index) => ({
      ...parityItems[index]!,
      filter: "catalog_reference" as const,
      targetMatches: row.targetMatches,
      legacyMatches: row.legacyMatches,
    })),
    parityContext,
  );

  return Number(count);
}

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/tags",
    summary: "Get bottle tags",
    description:
      "Retrieve tags associated with a bottle and their usage counts from tastings",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleTags",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          tag: z.string(),
          count: z.number(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, errors }) {
    const { limit, ...rest } = input;
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, rest.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const results = await db.query.bottleTags.findMany({
      where: (bottleTags, { eq }) => eq(bottleTags.bottleId, bottle.id),
      orderBy: (bottleTags, { desc }) => desc(bottleTags.count),
      limit,
    });

    try {
      const target = await loadCatalogTargetByBottleId(bottle.id, {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
      });
      return {
        results: results.map(({ tag, count }) => ({ tag, count })),
        totalCount: await countTaggedTastings(bottle.id, target.targetId),
      };
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
