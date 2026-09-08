import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import type { BottleClassifierRunOptions } from "@peated/bottle-classifier/internal/runtime";
import {
  classifyScrapedBottleReference as classifyWithServerAdapters,
  runScrapedBottleReference as runWithServerAdapters,
} from "./service";

/** Scraper work uses its configured overrides before application defaults. */
export async function classifyScrapedBottleReference(
  input: ClassifyBottleReferenceInput,
  classifyReference: typeof classifyWithServerAdapters = classifyWithServerAdapters,
) {
  return await classifyReference(input);
}

export async function runScrapedBottleReference(
  input: ClassifyBottleReferenceInput,
  options: BottleClassifierRunOptions = {},
  runReference: typeof runWithServerAdapters = runWithServerAdapters,
) {
  return await runReference(input, options);
}
