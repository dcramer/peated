// Compatibility exports for price-matching callers. New generic bottle
// classification code should import from `bottleReferenceCandidates.ts`.
export {
  BottleCandidateSearchInputSchema,
  extractBottleReferenceIdentity as extractStorePriceBottleDetails,
  searchBottleCandidates as findBottleMatchCandidates,
  findBottleReferenceCandidates as findStorePriceMatchCandidates,
  getBottleCandidateById as getBottleMatchCandidateById,
  mergeBottleCandidate as mergePriceMatchCandidate,
} from "./bottleReferenceCandidates";
