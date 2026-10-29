import { compareBottleFields } from "@peated/bottle-classifier/fieldConflicts";
import type { ProposedBottle } from "@peated/bottle-classifier/internal/types";
import type { AnyTransaction } from "@peated/server/db";
import { bottles, type BottleCheck } from "@peated/server/db/schema";
import { createOrReuseBottleInTransaction } from "@peated/server/lib/createBottle";
import { and, eq, gte, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

export class StaleBottleCreateError extends Error {
  constructor(public readonly bottleId: number) {
    super(
      `Bottle ${bottleId} was created while this decision was being made and may be the same release.`,
    );
    this.name = "StaleBottleCreateError";
  }
}

export type StaleCreateGuard = {
  proposedBottle: ProposedBottle;
  seenBottleIds: number[];
  checkStartedAt: Date;
};

/**
 * Bottle resolution rule (owner: Bottle matching): an automatic create is
 * stale when the proposed Brand gained a Bottle after the check began, the
 * check never saw it, and none of its facts conflict with the proposal.
 * Parallel checks of one release would otherwise each create a Bottle. The
 * caller sends the source to review instead. Reusing an exact existing Bottle
 * is never stale. Call it inside the caller's transaction: the error rolls
 * the new Bottle back, and the Brand lock keeps two such creates from both
 * passing.
 */
export async function createOrReuseFreshBottleInTransaction(
  tx: AnyTransaction,
  args: Parameters<typeof createOrReuseBottleInTransaction>[1],
  guard?: StaleCreateGuard,
) {
  const brandId = guard?.proposedBottle.brand.id;
  if (!guard || brandId == null)
    return await createOrReuseBottleInTransaction(tx, args);

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`bottle:brand-create:${brandId}`}))`,
  );
  const result = await createOrReuseBottleInTransaction(tx, args);
  if (!result.createResult) return result;

  const recent = await tx
    .select()
    .from(bottles)
    .where(
      and(
        eq(bottles.brandId, brandId),
        gte(bottles.createdAt, guard.checkStartedAt),
        notInArray(bottles.id, [...guard.seenBottleIds, result.bottle.id]),
      ),
    )
    .limit(50);
  const sibling = recent.find(
    (bottle) =>
      !compareBottleFields(guard.proposedBottle, bottle).conflicts.length,
  );
  if (sibling) throw new StaleBottleCreateError(sibling.id);
  return result;
}

// A saved check records when it finished. Its run began before the agent
// loop, with fact extraction and the first candidate search.
const CHECK_PREPARATION_MS = 2 * 60_000;
const SavedRunDurationSchema = z.object({
  agentDurationMs: z.number().nonnegative(),
});

/** The earliest time a saved check could have retrieved its candidates. */
export function bottleCheckStartedAt(
  check: Pick<BottleCheck, "createdAt" | "modelMetadata">,
) {
  // Older checks may lack run metadata; then only the preparation margin applies.
  const metadata = SavedRunDurationSchema.safeParse(check.modelMetadata);
  return new Date(
    check.createdAt.getTime() -
      (metadata.success ? metadata.data.agentDurationMs : 0) -
      CHECK_PREPARATION_MS,
  );
}
