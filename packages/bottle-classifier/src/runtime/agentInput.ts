import {
  BottleCandidateSearchInputSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleExtractedDetails,
} from "../classifierTypes";
import type { BottleReference } from "../contract";

const DEFAULT_MATCH_CANDIDATE_LIMIT = 15;

export function buildAgentInput({
  reference,
  extractedIdentity,
  initialCandidates,
  currentBottle,
  hasExactAliasMatch,
  candidateExpansion,
}: {
  reference: BottleReference;
  extractedIdentity: BottleExtractedDetails | null;
  initialCandidates: BottleCandidate[];
  currentBottle: BottleCandidate | null;
  hasExactAliasMatch: boolean;
  candidateExpansion: "initial_only" | "open";
}): string {
  /**
   * The model should see the raw reference, the best current extraction, and
   * the local candidate context in one stable envelope. Keeping this serialized
   * input shape explicit makes evals and downstream debugging much easier.
   */
  return JSON.stringify(
    {
      reference: {
        id: reference.id ?? null,
        name: reference.name,
        url: reference.url ?? null,
        imageUrl: reference.imageUrl ?? null,
        currentBottleId: reference.currentBottleId ?? null,
        currentReleaseId: reference.currentReleaseId ?? null,
      },
      candidateExpansion,
      currentBottle,
      extractedIdentity,
      localSearch: {
        hasExactAliasMatch,
        candidates: initialCandidates,
      },
    },
    null,
    2,
  );
}

export function buildDefaultBottleSearchInput({
  reference,
  extractedIdentity,
}: {
  reference: BottleReference;
  extractedIdentity: BottleExtractedDetails | null;
}): BottleCandidateSearchInput {
  /**
   * This is the cheap local-search seed used before the model asks for any
   * follow-up retrieval. It should stay conservative: only pass through
   * structured extraction fields we can trust as search constraints.
   */
  return BottleCandidateSearchInputSchema.parse({
    query: reference.name,
    brand: extractedIdentity?.brand ?? null,
    bottler: extractedIdentity?.bottler ?? null,
    expression: extractedIdentity?.expression ?? null,
    series: extractedIdentity?.series ?? null,
    distillery: extractedIdentity?.distillery ?? [],
    category: extractedIdentity?.category ?? null,
    stated_age: extractedIdentity?.stated_age ?? null,
    abv: extractedIdentity?.abv ?? null,
    cask_type: extractedIdentity?.cask_type ?? null,
    cask_size: extractedIdentity?.cask_size ?? null,
    cask_fill: extractedIdentity?.cask_fill ?? null,
    cask_strength: extractedIdentity?.cask_strength ?? null,
    single_cask: extractedIdentity?.single_cask ?? null,
    edition: extractedIdentity?.edition ?? null,
    vintage_year: extractedIdentity?.vintage_year ?? null,
    release_year: extractedIdentity?.release_year ?? null,
    currentBottleId: reference.currentBottleId ?? null,
    currentReleaseId: reference.currentReleaseId ?? null,
    limit: DEFAULT_MATCH_CANDIDATE_LIMIT,
  });
}
