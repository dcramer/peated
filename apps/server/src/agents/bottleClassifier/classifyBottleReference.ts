import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import type { BottleCheckRunOptions } from "@peated/bottle-classifier/internal/runtime";
import { classifyBottleReference as classifyBottleReferenceWithServerAdapters } from "./service";

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
  options?: BottleCheckRunOptions,
) {
  return await classifyBottleReferenceWithServerAdapters(input, options);
}
