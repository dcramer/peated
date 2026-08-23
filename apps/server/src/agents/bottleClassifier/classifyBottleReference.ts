import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
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
  runReference: typeof runBottleReferenceWithServerAdapters = runBottleReferenceWithServerAdapters,
) {
  return await runReference(input);
}
