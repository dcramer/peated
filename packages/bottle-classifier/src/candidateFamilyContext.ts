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
  };
}
