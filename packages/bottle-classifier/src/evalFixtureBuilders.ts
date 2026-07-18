import type {
  BottleCandidate,
  BottleExtractedDetails,
} from "./classifierTypes";

export function buildBottleCandidate(
  candidate: Pick<BottleCandidate, "bottleId" | "fullName"> &
    Partial<BottleCandidate>,
): BottleCandidate {
  return {
    kind: "bottle",
    releaseId: null,
    alias: null,
    bottleFullName: candidate.fullName,
    brand: null,
    bottler: null,
    series: null,
    distillery: [],
    category: null,
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    score: null,
    source: [],
    ...candidate,
  };
}

export function buildExtractedIdentity(
  identity: Partial<BottleExtractedDetails>,
): BottleExtractedDetails {
  return {
    brand: null,
    bottler: null,
    expression: null,
    series: null,
    distillery: [],
    category: null,
    stated_age: null,
    abv: null,
    release_year: null,
    vintage_year: null,
    cask_strength: null,
    single_cask: null,
    edition: null,
    ...identity,
  };
}
