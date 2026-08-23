import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
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
  runReference: typeof runWithServerAdapters = runWithServerAdapters,
) {
  return await runReference(input);
}
