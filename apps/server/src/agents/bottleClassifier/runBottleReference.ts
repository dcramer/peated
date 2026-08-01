import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import { runBottleReference as runBottleReferenceWithServerAdapters } from "./service";

export async function runBottleReference(input: ClassifyBottleReferenceInput) {
  return await runBottleReferenceWithServerAdapters(input);
}
