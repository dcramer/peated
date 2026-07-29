import { db, type AnyDatabase } from "@peated/server/db";
import { bottles, bottleTombstones, tastings } from "@peated/server/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";

const TASTING_BOTTLE_SCAN_BATCH_SIZE = 200;

export type UserBottleRead = Pick<
  typeof bottles.$inferSelect,
  "brandId" | "category" | "flavorProfile" | "groupId" | "id" | "statedAge"
>;

export type TastingBottleScanRow = {
  id: number;
  rating: number | null;
  bottle: UserBottleRead | null;
};

export type JoinedUserBottleRead = {
  storedBottleId: number | null;
  bottle: UserBottleRead | null;
  retiredBottleId: number | null;
};

export class UserBottleReadIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserBottleReadIntegrityError";
  }
}

/** Converts one direct Bottle join into an active Bottle or unresolved null. */
export function readJoinedUserBottle({
  storedBottleId,
  bottle,
  retiredBottleId,
}: JoinedUserBottleRead): UserBottleRead | null {
  if (storedBottleId === null) return null;
  if (!bottle) {
    throw new UserBottleReadIntegrityError(
      `Consumer references missing Bottle ${storedBottleId}.`,
    );
  }
  if (bottle.groupId === null) {
    throw new UserBottleReadIntegrityError(
      `Bottle ${bottle.id} has no BottleGroup.`,
    );
  }
  if (retiredBottleId !== null) {
    throw new UserBottleReadIntegrityError(
      `Consumer references retired Bottle ${bottle.id}.`,
    );
  }
  return bottle;
}

/**
 * Scans one user's Tastings through their authoritative direct Bottle reference.
 */
export async function* scanUserTastingBottles(
  userId: number,
  database: AnyDatabase = db,
): AsyncGenerator<TastingBottleScanRow[]> {
  let afterId: number | null = null;

  while (true) {
    const rows = await database
      .select({
        id: tastings.id,
        rating: tastings.rating,
        storedBottleId: tastings.bottleId,
        bottle: {
          id: bottles.id,
          groupId: bottles.groupId,
          brandId: bottles.brandId,
          category: bottles.category,
          flavorProfile: bottles.flavorProfile,
          statedAge: bottles.statedAge,
        },
        retiredBottleId: bottleTombstones.bottleId,
      })
      .from(tastings)
      .leftJoin(bottles, eq(bottles.id, tastings.bottleId))
      .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
      .where(
        and(
          eq(tastings.createdById, userId),
          afterId === null ? undefined : gt(tastings.id, afterId),
        ),
      )
      .orderBy(asc(tastings.id))
      .limit(TASTING_BOTTLE_SCAN_BATCH_SIZE);

    if (rows.length === 0) break;

    yield rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      bottle: readJoinedUserBottle(row),
    }));

    afterId = rows.at(-1)!.id;
    if (rows.length < TASTING_BOTTLE_SCAN_BATCH_SIZE) break;
  }
}
