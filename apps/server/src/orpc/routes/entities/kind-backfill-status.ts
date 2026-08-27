import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

type OwnerRow = { id: number; ownerId: number | null };

export function findOwnerLoopEntityIds(rows: OwnerRow[]): number[] {
  const ownerById = new Map(rows.map((row) => [row.id, row.ownerId]));
  const loopEntityIds = new Set<number>();

  for (const row of rows) {
    const path: number[] = [];
    const pathIndexes = new Map<number, number>();
    let entityId: number | null | undefined = row.id;

    while (entityId !== null && entityId !== undefined) {
      const loopStart = pathIndexes.get(entityId);
      if (loopStart !== undefined) {
        for (const loopEntityId of path.slice(loopStart)) {
          loopEntityIds.add(loopEntityId);
        }
        break;
      }

      pathIndexes.set(entityId, path.length);
      path.push(entityId);
      entityId = ownerById.get(entityId);
    }
  }

  return Array.from(loopEntityIds).sort((left, right) => left - right);
}

const CountSchema = z.number().int().nonnegative();

// This preparation route owns the final data gate. Remove it with the
// kind-backfill list after the final cutover is stable.
export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/entities/kind-backfill/status",
    summary: "Check Entity kind backfill status",
    description:
      "Report the kind, ownership, and active Bottle-link invariants required for the final Entity migration",
    spec: (spec) => ({
      ...spec,
      operationId: "getEntityKindBackfillStatus",
    }),
  })
  .output(
    z.object({
      ready: z.boolean(),
      entities: z.object({
        total: CountSchema,
        missingKind: CountSchema,
      }),
      owners: z.object({
        links: CountSchema,
        invalid: CountSchema,
        loopEntityIds: z.array(z.number().int().positive()),
      }),
      bottleLinks: z.object({
        activeBottles: CountSchema,
        brand: CountSchema,
        bottler: CountSchema,
        distiller: CountSchema,
      }),
    }),
  )
  .handler(async function () {
    const activeBottleCondition = and(
      isNotNull(bottles.groupId),
      sql`NOT EXISTS(
        SELECT FROM ${bottleTombstones}
        WHERE ${bottleTombstones.bottleId} = ${bottles.id}
      )`,
    );

    const [[entityCounts], [bottleCounts], [distillerCounts], ownerRows] =
      await Promise.all([
        db
          .select({
            total: sql<number>`COUNT(*)::int`,
            missingKind: sql<number>`COUNT(*) FILTER (WHERE ${entities.kind} IS NULL)::int`,
          })
          .from(entities),
        db
          .select({
            activeBottles: sql<number>`COUNT(*)::int`,
            brand: sql<number>`COUNT(${bottles.brandId})::int`,
            bottler: sql<number>`COUNT(${bottles.bottlerId})::int`,
          })
          .from(bottles)
          .where(activeBottleCondition),
        db
          .select({
            distiller: sql<number>`COUNT(*)::int`,
          })
          .from(bottlesToDistillers)
          .innerJoin(bottles, eq(bottles.id, bottlesToDistillers.bottleId))
          .where(activeBottleCondition),
        db
          .select({ id: entities.id, ownerId: entities.ownerId })
          .from(entities),
      ]);

    if (!entityCounts || !bottleCounts || !distillerCounts) {
      throw new Error("Entity kind backfill status query returned no row.");
    }

    const entityIds = new Set(ownerRows.map(({ id }) => id));
    const invalidOwners = ownerRows.filter(
      ({ ownerId }) => ownerId !== null && !entityIds.has(ownerId),
    );
    const loopEntityIds = findOwnerLoopEntityIds(ownerRows);
    const ownerLinks = ownerRows.filter(({ ownerId }) => ownerId !== null);
    const ready =
      entityCounts.missingKind === 0 &&
      invalidOwners.length === 0 &&
      loopEntityIds.length === 0;

    return {
      ready,
      entities: entityCounts,
      owners: {
        links: ownerLinks.length,
        invalid: invalidOwners.length,
        loopEntityIds,
      },
      bottleLinks: {
        ...bottleCounts,
        distiller: distillerCounts.distiller,
      },
    };
  });
