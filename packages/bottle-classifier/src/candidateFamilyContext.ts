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

  const siblingBottlesById = new Map(
    existing.siblingBottles.map((bottle) => [bottle.bottleId, bottle]),
  );
  for (const bottle of candidate.siblingBottles) {
    siblingBottlesById.set(bottle.bottleId, bottle);
  }

  return {
    siblingBottles: Array.from(siblingBottlesById.values()),
  };
}
