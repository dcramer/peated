import { BottleCandidateSchema } from "@peated/bottle-classifier/contract";
import type { BottleCandidate } from "@peated/bottle-classifier/internal/types";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";

/**
 * Returns one literal stored-alias candidate. The full classifier still owns
 * the identity decision and receives this result only as deterministic evidence.
 */
export async function findExactAliasBottleCandidate(
  referenceName: string,
): Promise<BottleCandidate | null> {
  const bottleId = await findBottleId(referenceName);
  if (bottleId === null) {
    return null;
  }

  const candidate = await getBottleCandidateById(bottleId);
  if (!candidate) {
    return null;
  }

  return BottleCandidateSchema.parse({
    ...candidate,
    source: Array.from(new Set([...candidate.source, "exact"])),
  });
}
