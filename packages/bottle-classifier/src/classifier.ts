import {
  createBottleClassifier as createInternalBottleClassifier,
  type BottleClassifierAdapters,
  type BottleClassifier as InternalBottleClassifier,
  type CreateBottleClassifierOptions as InternalCreateBottleClassifierOptions,
} from "./classifierRuntime";

export type BottleClassifier = Pick<
  InternalBottleClassifier,
  "classifyBottleReference" | "extractBottleReferenceIdentity"
>;

export type CreateBottleClassifierOptions = Omit<
  InternalCreateBottleClassifierOptions,
  "overrides"
>;

export type { BottleClassifierAdapters };

export function createBottleClassifier(
  options: CreateBottleClassifierOptions,
): BottleClassifier {
  return createInternalBottleClassifier(options);
}
