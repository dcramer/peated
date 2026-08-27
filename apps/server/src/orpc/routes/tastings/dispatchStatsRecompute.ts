import {
  buildBottleStatsRecomputeJob,
  dispatchBottleStatsRecompute,
} from "@peated/server/lib/dispatchBottleStatsRecompute";

/** Builds direct-Bottle aggregate work for a persisted Tasting change. */
export function buildTastingStatsRecomputeJob(
  bottleId: number,
): ReturnType<typeof buildBottleStatsRecomputeJob> {
  return buildBottleStatsRecomputeJob(bottleId);
}

/**
 * Queue recomputation after commit. Publication failures are logged and
 * swallowed because the authoritative tasting write is already durable.
 */
export async function dispatchTastingStatsRecompute(
  tastingId: number,
  bottleId: number,
): Promise<void> {
  await dispatchBottleStatsRecompute("tasting", tastingId, bottleId);
}
