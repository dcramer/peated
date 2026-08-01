import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import { classifyBottleReference as classifyBottleReferenceWithServerAdapters } from "./service";

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return await classifyBottleReferenceWithServerAdapters(input);
}
