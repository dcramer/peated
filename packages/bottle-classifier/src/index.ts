export {
  inferBottleCreationTarget,
  normalizeBottleCreationDrafts,
  normalizeProposedBottleDraft,
  splitProposedBottleReleaseDraft,
} from "./bottleCreationDrafts";
export type { BottleCreationTarget } from "./bottleCreationDrafts";
export {
  formatCanonicalReleaseName,
  getResolvedReleaseIdentity,
  hasExtractedReleaseIdentity,
} from "./bottleSchemaRules";
export type { ReleaseIdentityInput } from "./bottleSchemaRules";
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
  ClassifyBottleReferenceInputSchema,
  DecidedBottleClassificationResultSchema,
  IgnoredBottleClassificationResultSchema,
  isIgnoredBottleClassification,
} from "./contract";
export type {
  BottleClassificationArtifacts,
  BottleClassificationResult,
  BottleReference,
  ClassifyBottleReferenceInput,
  DecidedBottleClassificationResult,
  IgnoredBottleClassificationResult,
} from "./contract";
export { BottleClassificationError } from "./error";
export { createWhiskyLabelExtractor } from "./extractor";
export { normalizeBottle, type NormalizedBottle } from "./normalize";
