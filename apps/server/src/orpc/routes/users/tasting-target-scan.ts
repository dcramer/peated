import { db, type AnyDatabase } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { loadCatalogTargetReadsWithParity } from "@peated/server/lib/catalogTargetReadParity";
import type {
  BottleGroupV1,
  ConcreteBottleV1,
} from "@peated/server/schemas/catalogIdentity";
import { and, asc, eq, gt } from "drizzle-orm";

const TASTING_TARGET_SCAN_BATCH_SIZE = 200;

export type TastingTargetIdentity =
  | {
      kind: "bottle";
      targetId: number;
      bottle: ConcreteBottleV1;
    }
  | {
      kind: "group";
      targetId: number;
      group: BottleGroupV1;
    };

export type TastingTargetScanRow = {
  id: number;
  rating: number | null;
  identity: TastingTargetIdentity | null;
};

type TastingTargetScanContext = {
  caller: string;
  operation: string;
};

/**
 * Scans one user's Tastings through authoritative CatalogTarget identity.
 * Retained Bottle fields remain internal parity evidence and never reach callers.
 */
export async function* scanUserTastingTargets(
  userId: number,
  context: TastingTargetScanContext,
  database: AnyDatabase = db,
): AsyncGenerator<TastingTargetScanRow[]> {
  let afterId: number | null = null;

  while (true) {
    const rows = await database
      .select({
        id: tastings.id,
        rating: tastings.rating,
        targetId: tastings.targetId,
        bottleId: tastings.bottleId,
        releaseId: tastings.releaseId,
      })
      .from(tastings)
      .where(
        and(
          eq(tastings.createdById, userId),
          afterId === null ? undefined : gt(tastings.id, afterId),
        ),
      )
      .orderBy(asc(tastings.id))
      .limit(TASTING_TARGET_SCAN_BATCH_SIZE);

    if (rows.length === 0) break;

    const { targets } = await loadCatalogTargetReadsWithParity(
      rows.map((row) => ({
        consumerTable: "tasting" as const,
        rowLocator: { id: row.id },
        targetId: row.targetId,
        legacy: {
          bottleId: row.bottleId,
          releaseId: row.releaseId,
        },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        ...context,
      },
      database,
    );

    yield rows.map((row, index) => {
      const target = targets[index];
      if (target === undefined) {
        throw new Error(`Missing CatalogTarget result for Tasting ${row.id}`);
      }

      const identity: TastingTargetIdentity | null =
        target === null
          ? null
          : target.kind === "bottle"
            ? {
                kind: target.kind,
                targetId: target.targetId,
                bottle: target.bottle,
              }
            : {
                kind: target.kind,
                targetId: target.targetId,
                group: target.group,
              };

      return {
        id: row.id,
        rating: row.rating,
        identity,
      };
    });

    afterId = rows.at(-1)!.id;
    if (rows.length < TASTING_TARGET_SCAN_BATCH_SIZE) break;
  }
}
