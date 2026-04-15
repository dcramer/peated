export {
  inferBottleCreationTarget,
  normalizeBottleCreationDrafts,
  normalizeProposedBottleDraft,
  splitProposedBottleReleaseDraft,
} from "./bottleCreationDrafts";
export type { BottleCreationTarget } from "./bottleCreationDrafts";
export {
  createBottleClassifier,
  type BottleClassifier,
  type BottleClassifierAdapters,
  type CreateBottleClassifierOptions,
} from "./classifier";
export {
  BottleClassificationArtifactsSchema,
  BottleClassificationResultSchema,
  BottleReferenceSchema,
  CandidateExpansionModeSchema,
  ClassifyBottleReferenceInputSchema,
  DecidedBottleClassificationResultSchema,
  IgnoredBottleClassificationResultSchema,
  isIgnoredBottleClassification,
} from "./contract";
export type {
  BottleClassificationArtifacts,
  BottleClassificationResult,
  BottleReference,
  CandidateExpansionMode,
  ClassifyBottleReferenceInput,
  DecidedBottleClassificationResult,
  IgnoredBottleClassificationResult,
} from "./contract";
export { BottleClassificationError } from "./error";
export { createWhiskyLabelExtractor } from "./extractor";
export { normalizeBottle, type NormalizedBottle } from "./normalize";
export {
  formatCanonicalReleaseName,
  getResolvedReleaseIdentity,
  hasExtractedReleaseIdentity,
} from "./releaseIdentity";
export type { ReleaseIdentityInput } from "./releaseIdentity";
