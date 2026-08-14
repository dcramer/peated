import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import {
  classifyScrapedBottleReference as classifyWithServerAdapters,
  runScrapedBottleReference as runWithServerAdapters,
} from "./service";

/** Scraper work uses its configured overrides before application defaults. */
export async function classifyScrapedBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return await classifyWithServerAdapters(input);
}

export async function runScrapedBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return await runWithServerAdapters(input);
}
