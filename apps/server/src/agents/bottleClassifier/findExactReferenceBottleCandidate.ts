import { BottleCandidateSchema } from "@peated/bottle-classifier/contract";
import type { BottleCandidate } from "@peated/bottle-classifier/internal/types";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";

/**
 * Returns one literal stored-reference candidate. A caller can accept its assigned
 * Bottle as a deterministic Match without a classifier model call.
 */
export async function findExactReferenceBottleCandidate(
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
