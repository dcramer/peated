import type { ClassifyBottleReferenceInput } from "@peated/bottle-classifier";
import { identifyExistingBottleReference as identifyExistingBottleReferenceInService } from "./service";

export async function identifyExistingBottleReference(
  input: ClassifyBottleReferenceInput,
  options?: {
    allowExactAliasPreflight?: boolean;
  },
) {
  return await identifyExistingBottleReferenceInService(input, options);
}
