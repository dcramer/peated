// Compatibility exports for price-matching callers. New generic bottle
// classification code should import from `bottleCreationDrafts.ts`.
export {
  inferBottleCreationTarget as inferPriceMatchCreationTarget,
  normalizeBottleCreationDrafts as normalizeCreateNewDrafts,
  normalizeProposedBottleDraft,
  splitProposedBottleReleaseDraft,
} from "./bottleCreationDrafts";
