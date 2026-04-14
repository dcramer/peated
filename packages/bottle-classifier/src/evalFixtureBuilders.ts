import type {
  BottleCandidate,
  BottleExtractedDetails,
} from "./classifierSchemas";
import type { LegacyReleaseRepairParentCandidate } from "./legacyReleaseRepairIdentity";

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
    caskType: null,
    caskSize: null,
    caskFill: null,
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
    cask_type: null,
    cask_size: null,
    cask_fill: null,
    cask_strength: null,
    single_cask: null,
    edition: null,
    ...identity,
  };
}

export function buildLegacyReleaseRepairParentCandidate(
  candidate: Pick<LegacyReleaseRepairParentCandidate, "fullName" | "id"> &
    Partial<LegacyReleaseRepairParentCandidate>,
): LegacyReleaseRepairParentCandidate {
  const { fullName, id, ...overrides } = candidate;

  return {
    abv: null,
    category: null,
    caskFill: null,
    caskSize: null,
    caskStrength: null,
    caskType: null,
    edition: null,
    fullName,
    id,
    releaseYear: null,
    singleCask: null,
    statedAge: null,
    totalTastings: null,
    vintageYear: null,
    ...overrides,
  };
}
