import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  collectionBottles,
  collections,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import {
  loadCatalogTargetReadsWithParity,
  recordCatalogTargetReadFilterParity,
} from "@peated/server/lib/catalogTargetReadParity";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetByBottleId,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { CollectionSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CollectionSerializer } from "@peated/server/serializers/collection";
import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

function legacyCollectionBottleFilterCandidates(
  bottleId: number,
): SQL<unknown> {
  const predicate = or(
    eq(collectionBottles.bottleId, bottleId),
    sql`exists(${db
      .select({ value: sql`1` })
      .from(bottleReleases)
      .innerJoin(
        bottleReleasePromotions,
        eq(bottleReleasePromotions.releaseId, bottleReleases.id),
      )
      .where(
        and(
          eq(bottleReleases.id, collectionBottles.releaseId),
          eq(bottleReleases.bottleId, collectionBottles.bottleId),
          eq(bottleReleasePromotions.status, "promoted"),
          eq(bottleReleasePromotions.promotedBottleId, bottleId),
        ),
      )})`,
  );
  if (!predicate) {
    throw new TypeError("Missing legacy collection Bottle filter predicate");
  }
  return predicate;
}

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/users/{user}/collections",
    summary: "List user collections",
    description:
      "Retrieve collections for a specific user with optional bottle filtering. Respects user privacy settings",
    operationId: "listCollections",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      bottle: z.coerce.number().gte(1).optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  // TODO(response-envelope): use helper to enable later switch to { data, meta }
  .output(listResponse(CollectionSchema))
  .handler(async function ({
    input: { cursor, limit, ...input },
    context,
    errors,
  }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is private.",
      });
    }

    const offset = (cursor - 1) * limit;

    const where = [sql`${collections.createdById} = ${user.id}`];
    let bottleFilter:
      | {
          bottleId: number;
          targetWhere: SQL<unknown>;
          legacyCandidateWhere: SQL<unknown>;
        }
      | undefined;
    if (input.bottle !== undefined) {
      const bottle = await db.query.bottles.findFirst({
        where: eq(bottles.id, input.bottle),
        columns: { id: true },
      });
      if (!bottle) {
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
        });
      }

      try {
        const target = await loadCatalogTargetByBottleId(bottle.id, {
          actor: null,
          permissions: { canReadCatalogIdentity: true },
        });
        const targetWhere = eq(collectionBottles.targetId, target.targetId);
        const legacyCandidateWhere = legacyCollectionBottleFilterCandidates(
          bottle.id,
        );
        where.push(
          sql`EXISTS(
            SELECT 1
            FROM ${collectionBottles}
            WHERE ${collectionBottles.collectionId} = ${collections.id}
              AND ${targetWhere}
          )`,
        );
        bottleFilter = {
          bottleId: bottle.id,
          targetWhere,
          legacyCandidateWhere,
        };
      } catch (error) {
        if (error instanceof CatalogTargetResolutionError) {
          throw errors.CONFLICT({ message: error.message, cause: error });
        }
        throw error;
      }
    }

    const results = await db
      .select()
      .from(collections)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(collections.name), asc(collections.id));

    if (bottleFilter) {
      const candidates = await db
        .select({
          id: collectionBottles.id,
          targetId: collectionBottles.targetId,
          bottleId: collectionBottles.bottleId,
          releaseId: collectionBottles.releaseId,
          targetMatches: sql<boolean>`COALESCE(${bottleFilter.targetWhere}, false)`,
        })
        .from(collectionBottles)
        .innerJoin(
          collections,
          eq(collections.id, collectionBottles.collectionId),
        )
        .where(
          and(
            eq(collections.createdById, user.id),
            or(bottleFilter.targetWhere, bottleFilter.legacyCandidateWhere),
          ),
        )
        .limit(limit + 1)
        // Collection pagination cannot be applied to row-correlated evidence.
        // Keep a stable bounded sample without changing authoritative results.
        .orderBy(
          asc(collections.name),
          asc(collections.id),
          asc(collectionBottles.id),
        );
      let legacyTargets: Awaited<
        ReturnType<typeof loadCatalogTargetReadsWithParity>
      >["legacyTargets"];
      try {
        ({ legacyTargets } = await loadCatalogTargetReadsWithParity(
          candidates.map((candidate) => ({
            consumerTable: "collection_bottle",
            rowLocator: { id: candidate.id },
            targetId: candidate.targetId,
            legacy: {
              bottleId: candidate.bottleId,
              releaseId: candidate.releaseId,
            },
          })),
          {
            actor: null,
            permissions: { canReadCatalogIdentity: true },
            caller: "collections.list",
            operation: "filterResolution",
          },
        ));
      } catch (error) {
        if (error instanceof CatalogTargetResolutionError) {
          throw errors.CONFLICT({ message: error.message, cause: error });
        }
        throw error;
      }
      recordCatalogTargetReadFilterParity(
        candidates.map((candidate, index) => {
          const legacyTarget = legacyTargets[index] ?? null;
          return {
            consumerTable: "collection_bottle" as const,
            rowLocator: { id: candidate.id },
            targetId: candidate.targetId,
            legacy: {
              bottleId: candidate.bottleId,
              releaseId: candidate.releaseId,
            },
            filter: "catalog_reference" as const,
            targetMatches: candidate.targetMatches,
            legacyMatches:
              legacyTarget?.kind === "bottle" &&
              legacyTarget.bottle.id === bottleFilter.bottleId,
          };
        }),
        { caller: "collections.list", operation: "filter" },
      );
    }

    return {
      results: await serialize(
        CollectionSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
