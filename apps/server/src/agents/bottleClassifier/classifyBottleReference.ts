import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import type { BottleClassifierRunOptions } from "@peated/bottle-classifier/internal/runtime";
import {
  classifyBottleReference as classifyBottleReferenceWithServerAdapters,
  runBottleReference as runBottleReferenceWithServerAdapters,
} from "./service";

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
  classifyReference: typeof classifyBottleReferenceWithServerAdapters = classifyBottleReferenceWithServerAdapters,
) {
  return await classifyReference(input);
}

export async function runBottleReference(
  input: ClassifyBottleReferenceInput,
  options?: BottleClassifierRunOptions,
  runReference: typeof runBottleReferenceWithServerAdapters = runBottleReferenceWithServerAdapters,
) {
  return await runReference(input, options);
}
