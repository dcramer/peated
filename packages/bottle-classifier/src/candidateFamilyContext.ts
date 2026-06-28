import type { BottleCandidate } from "./classifierTypes";

type BottleCandidateFamilyContext = BottleCandidate["familyContext"];

export function mergeBottleCandidateFamilyContext(
  existing: BottleCandidateFamilyContext,
  candidate: BottleCandidateFamilyContext,
): BottleCandidateFamilyContext {
  if (!existing) {
    return candidate;
  }
  if (!candidate) {
    return existing;
  }

  const siblingReleasesById = new Map(
    existing.siblingReleases.map((release) => [release.releaseId, release]),
  );
  for (const release of candidate.siblingReleases) {
    siblingReleasesById.set(release.releaseId, release);
  }
  const siblingBottlesById = new Map(
    existing.siblingBottles.map((bottle) => [bottle.bottleId, bottle]),
  );
  for (const bottle of candidate.siblingBottles) {
    siblingBottlesById.set(bottle.bottleId, bottle);
  }

  return {
    parentBottleReleaseTraits: Array.from(
      new Set([
        ...existing.parentBottleReleaseTraits,
        ...candidate.parentBottleReleaseTraits,
      ]),
    ),
    childReleaseCount: Math.max(
      existing.childReleaseCount,
      candidate.childReleaseCount,
    ),
    siblingReleases: Array.from(siblingReleasesById.values()),
    siblingBottles: Array.from(siblingBottlesById.values()),
  };
}
