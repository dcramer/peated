import { ORPCError } from "@orpc/server";
import type { AnyDatabase, AnyTransaction } from "@peated/server/db";
import type { NewTasting, Tasting, User } from "@peated/server/db/schema";
import { tastings } from "@peated/server/db/schema";
import { awardAllBadgeXp } from "@peated/server/lib/badges";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { and, eq } from "drizzle-orm";
import { isTastingIdentityConflict } from "./isTastingIdentityConflict";

type BadgeAwards = Awaited<ReturnType<typeof awardAllBadgeXp>>;

export type InsertedTasting =
  | { replayed: false; tasting: Tasting; awards: BadgeAwards }
  | { replayed: true; tasting: Tasting };

/** Finds the member's tasting that was posted with `idempotencyKey`. */
export async function findTastingByIdempotencyKey(
  database: AnyDatabase,
  userId: number,
  idempotencyKey: string,
): Promise<Tasting | null> {
  const [tasting] = await database
    .select()
    .from(tastings)
    .where(
      and(
        eq(tastings.createdById, userId),
        eq(tastings.idempotencyKey, idempotencyKey),
      ),
    );
  return tasting ?? null;
}

/**
 * Inserts a tasting of an active Bottle and awards badges in the caller's
 * transaction. Used by `POST /tastings` and by publishing a tasting draft.
 *
 * When the member already posted a tasting with the same `idempotencyKey`,
 * returns that tasting with `replayed` set and awards nothing.
 */
export async function insertTasting(
  tx: AnyTransaction,
  values: NewTasting,
  currentUser: User,
): Promise<InsertedTasting> {
  try {
    await resolveActiveBottleIds(tx, [values.bottleId]);
  } catch (error) {
    if (!(error instanceof ActiveBottleSelectionError)) throw error;
    throw new ORPCError("BAD_REQUEST", {
      message: "Cannot identify bottle.",
      cause: error,
    });
  }

  let tasting: Tasting | undefined;
  try {
    [tasting] = await tx
      .insert(tastings)
      .values(values)
      .onConflictDoNothing({
        target: [tastings.createdById, tastings.idempotencyKey],
      })
      .returning();
  } catch (error) {
    if (error instanceof Error && isTastingIdentityConflict(error)) {
      throw new ORPCError("CONFLICT", {
        message: "Tasting already exists.",
        cause: error,
      });
    }
    throw error;
  }

  if (!tasting) {
    // A concurrent request with the same key created the tasting first.
    const existing = values.idempotencyKey
      ? await findTastingByIdempotencyKey(
          tx,
          values.createdById,
          values.idempotencyKey,
        )
      : null;
    if (!existing) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Unable to create tasting.",
      });
    }
    return { replayed: true, tasting: existing };
  }

  const awards = await awardAllBadgeXp(tx, tasting);
  for (const award of awards) {
    Object.assign(award, {
      badge: await serialize(BadgeSerializer, award.badge, currentUser),
    });
  }

  return { replayed: false, tasting, awards };
}
