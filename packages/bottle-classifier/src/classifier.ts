import {
  createBottleClassifier as createInternalBottleClassifier,
  type BottleClassifierAdapters,
  type BottleClassifierDataSource,
  type BottleReferenceRun,
  type BottleClassifier as InternalBottleClassifier,
  type CreateBottleClassifierOptions as InternalCreateBottleClassifierOptions,
} from "./classifierRuntime";

/**
 * Reviewed public classifier boundary.
 *
 * Keep this surface small. Callers should get a validated reference decision
 * or Bottle audit from here rather than reaching into raw agent internals.
 */
export type BottleClassifier = Pick<
  InternalBottleClassifier,
  | "runBottleReference"
  | "classifyBottleReference"
  | "auditBottle"
  | "identifyExistingBottleReference"
  | "extractBottleReferenceIdentity"
>;

export type CreateBottleClassifierOptions =
  InternalCreateBottleClassifierOptions extends infer T
    ? T extends unknown
      ? Omit<T, "overrides">
      : never
    : never;

export {
  BottleClassifierRunMetadataSchema,
  type BottleClassifierRunMetadata,
} from "./runtime/runMetadata";
export type {
  BottleClassifierAdapters,
  BottleClassifierDataSource,
  BottleReferenceRun,
};

/**
 * Creates the reviewed bottle classifier.
 *
 * The returned object exposes only the stable check/extract entrypoints. Raw
 * agent orchestration and test-only hooks stay behind internal subpaths.
 */
export function createBottleClassifier(
  options: CreateBottleClassifierOptions,
): BottleClassifier {
  return createInternalBottleClassifier(options);
}
