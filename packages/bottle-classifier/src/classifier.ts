import {
  createBottleClassifier as createInternalBottleClassifier,
  type BottleClassifierAdapters,
  type BottleClassifier as InternalBottleClassifier,
  type CreateBottleClassifierOptions as InternalCreateBottleClassifierOptions,
} from "./classifierRuntime";

/**
 * Reviewed public classifier boundary.
 *
 * Keep this surface small. Callers should get a fully reviewed identity
 * decision from here rather than reaching into the raw agent/runtime internals.
 */
export type BottleClassifier = Pick<
  InternalBottleClassifier,
  "classifyBottleReference" | "extractBottleReferenceIdentity"
>;

export type CreateBottleClassifierOptions = Omit<
  InternalCreateBottleClassifierOptions,
  "overrides"
>;

export type { BottleClassifierAdapters };

/**
 * Creates the reviewed bottle classifier.
 *
 * The returned object exposes only the stable classify/extract entrypoints. Raw
 * agent orchestration and test-only hooks stay behind internal subpaths.
 */
export function createBottleClassifier(
  options: CreateBottleClassifierOptions,
): BottleClassifier {
  return createInternalBottleClassifier(options);
}
