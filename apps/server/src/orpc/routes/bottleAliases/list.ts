import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
} from "@peated/server/db/schema";
import {
  loadCatalogTargetReadsWithParity,
  loadLegacyCatalogTargetReadBatch,
  recordCatalogTargetReadFilterParity,
} from "@peated/server/lib/catalogTargetReadParity";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetByBottleId,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import {
  CatalogTargetV1Schema,
  listResponse,
  type CatalogTargetV1,
} from "@peated/server/schemas";
import {
  and,
  asc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

const OutputSchema = listResponse(
  z.object({
    name: z.string(),
    createdAt: z.string(),
    bottleId: z.number().nullable(),
    target: CatalogTargetV1Schema.nullable(),
    isCanonical: z.boolean().optional(),
  }),
);

function legacyAliasBottleFilterCandidates(bottleId: number): SQL<unknown> {
  const predicate = or(
    eq(bottleAliases.bottleId, bottleId),
    sql`exists(${db
      .select({ value: sql`1` })
      .from(bottleReleases)
      .innerJoin(
        bottleReleasePromotions,
        eq(bottleReleasePromotions.releaseId, bottleReleases.id),
      )
      .where(
        and(
          eq(bottleReleases.id, bottleAliases.releaseId),
          eq(bottleReleases.bottleId, bottleAliases.bottleId),
          eq(bottleReleasePromotions.status, "promoted"),
          eq(bottleReleasePromotions.promotedBottleId, bottleId),
        ),
      )})`,
  );
  if (!predicate) throw new TypeError("Missing legacy alias filter predicate");
  return predicate;
}

export default procedure
  .route({
    method: "GET",
    path: "/bottle-aliases",
    summary: "List bottle aliases",
    description:
      "Retrieve bottle aliases with filtering by bottle, unknown status, and search support",
    operationId: "listBottleAliases",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().optional(),
        query: z.string().default(""),
        onlyUnknown: z.coerce.boolean().optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .output(OutputSchema)
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    errors,
  }) {
    const baseWhere: SQL<unknown>[] = [eq(bottleAliases.ignored, false)];
    const targetWhere: SQL<unknown>[] = [];
    const parityFilters: (
      | {
          filter: "catalog_reference";
          targetWhere: SQL<unknown>;
          legacyCandidateWhere: SQL<unknown>;
          bottleId: number;
        }
      | {
          filter: "only_unknown";
          targetWhere: SQL<unknown>;
          legacyCandidateWhere: SQL<unknown>;
        }
    )[] = [];

    let bottle: Bottle | null = null;
    if (input.bottle) {
      [bottle] = await db
        .select()
        .from(bottles)
        .where(eq(bottles.id, input.bottle));

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
        const authoritativeWhere = eq(bottleAliases.targetId, target.targetId);
        const legacyCandidateWhere = legacyAliasBottleFilterCandidates(
          bottle.id,
        );
        targetWhere.push(authoritativeWhere);
        parityFilters.push({
          filter: "catalog_reference",
          targetWhere: authoritativeWhere,
          legacyCandidateWhere,
          bottleId: bottle.id,
        });
      } catch (error) {
        if (error instanceof CatalogTargetResolutionError) {
          throw errors.CONFLICT({ message: error.message, cause: error });
        }
        throw error;
      }
    }

    if (input.onlyUnknown) {
      const authoritativeWhere = isNull(bottleAliases.targetId);
      const legacyCandidateWhere = isNull(bottleAliases.bottleId);
      targetWhere.push(authoritativeWhere);
      parityFilters.push({
        filter: "only_unknown",
        targetWhere: authoritativeWhere,
        legacyCandidateWhere,
      });
    }

    if (query) {
      baseWhere.push(ilike(bottleAliases.name, `%${query}%`));
    }

    const offset = (cursor - 1) * limit;

    const { embedding, ...columns } = getTableColumns(bottleAliases);
    const results = await db
      .select(columns)
      .from(bottleAliases)
      .where(and(...baseWhere, ...targetWhere))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottleAliases.name));

    const page = results.slice(0, limit);
    let targets: (CatalogTargetV1 | null)[];
    try {
      ({ targets } = await loadCatalogTargetReadsWithParity(
        page.map((alias) => ({
          consumerTable: "bottle_alias",
          rowLocator: { name: alias.name },
          targetId: alias.targetId,
          legacy: {
            bottleId: alias.bottleId,
            releaseId: alias.releaseId,
          },
        })),
        {
          actor: null,
          permissions: { canReadCatalogIdentity: true },
          caller: "bottleAliases.list",
          operation: "hydrate",
        },
      ));
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    await Promise.all(
      parityFilters.map(async (parityFilter) => {
        const candidates = await db
          .select({
            name: bottleAliases.name,
            targetId: bottleAliases.targetId,
            bottleId: bottleAliases.bottleId,
            releaseId: bottleAliases.releaseId,
            targetMatches: sql<boolean>`COALESCE(${parityFilter.targetWhere}, false)`,
            legacyCandidateMatches: sql<boolean>`COALESCE(${parityFilter.legacyCandidateWhere}, false)`,
          })
          .from(bottleAliases)
          .where(
            and(
              ...baseWhere,
              or(parityFilter.targetWhere, parityFilter.legacyCandidateWhere),
            ),
          )
          .limit(limit + 1)
          .offset(offset)
          .orderBy(asc(bottleAliases.name));

        const legacyResults =
          parityFilter.filter === "catalog_reference"
            ? await loadLegacyCatalogTargetReadBatch(
                candidates.map(({ bottleId, releaseId }) => ({
                  bottleId,
                  releaseId,
                })),
                {
                  actor: null,
                  permissions: { canReadCatalogIdentity: true },
                  caller: "bottleAliases.list",
                  operation: "filterLegacyMembership",
                },
              )
            : null;
        const measuredCandidates = candidates.map((candidate, index) => {
          const legacyTarget = legacyResults?.[index]?.target ?? null;
          return {
            consumerTable: "bottle_alias" as const,
            rowLocator: { name: candidate.name },
            targetId: candidate.targetId,
            legacy: {
              bottleId: candidate.bottleId,
              releaseId: candidate.releaseId,
            },
            filter: parityFilter.filter,
            targetMatches: candidate.targetMatches,
            legacyMatches:
              parityFilter.filter === "catalog_reference"
                ? legacyTarget?.kind === "bottle" &&
                  legacyTarget.bottle.id === parityFilter.bottleId
                : candidate.legacyCandidateMatches,
          };
        });
        recordCatalogTargetReadFilterParity(measuredCandidates, {
          caller: "bottleAliases.list",
          operation: "filter",
        });
      }),
    );

    return {
      results: page.map((alias, index) => {
        // CatalogTarget owns identity; the retained pair is parity evidence only.
        const target = targets[index] ?? null;
        return {
          name: alias.name,
          createdAt: alias.createdAt.toISOString(),
          bottleId: target?.kind === "bottle" ? target.bottle.id : null,
          target,
          isCanonical: bottle ? bottle.fullName === alias.name : undefined,
        };
      }),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
