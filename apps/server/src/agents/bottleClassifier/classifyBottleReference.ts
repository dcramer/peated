import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import {
  classifyBottleReference as classifyBottleReferenceWithServerAdapters,
  runBottleReference as runBottleReferenceWithServerAdapters,
} from "./service";

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return await classifyBottleReferenceWithServerAdapters(input);
}

export async function runBottleReference(input: ClassifyBottleReferenceInput) {
  return await runBottleReferenceWithServerAdapters(input);
}
