import type { ConcreteBottleCreateInput } from "@peated/server/lib/concreteBottleSchemas";
import {
  buildLegacyConcreteBottleInput,
  InvalidLegacyConcreteBottleInputError,
  type LegacyConcreteBottleStableInput,
} from "@peated/server/lib/legacyConcreteBottleInput";
import type {
  BottleInputSchema,
  BottleReleaseInputSchema,
} from "@peated/server/schemas";
import type { z } from "zod";

type LegacyBottleInput = z.infer<typeof BottleInputSchema>;
type LegacyBottleReleaseInput = z.infer<typeof BottleReleaseInputSchema>;

export class InvalidPriceMatchConcreteBottleInputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidPriceMatchConcreteBottleInputError";
  }
}

/**
 * Translates the retained price-match Bottle/BottleRelease creation contract
 * into the single canonical concrete-Bottle creation input.
 */
export function buildPriceMatchConcreteBottleInput({
  bottleInput,
  releaseInput,
  parentBottleId,
  sourceBottleStableInput,
}: {
  bottleInput?: LegacyBottleInput;
  releaseInput?: LegacyBottleReleaseInput;
  parentBottleId: number | null;
  sourceBottleStableInput?: LegacyConcreteBottleStableInput;
}): {
  creationTarget: "bottle" | "release" | "bottle_and_release";
  input: ConcreteBottleCreateInput;
} {
  try {
    return buildLegacyConcreteBottleInput({
      bottleInput,
      releaseInput,
      parentBottleId,
      sourceBottleStableInput,
      source: "price-match",
    });
  } catch (error) {
    if (!(error instanceof InvalidLegacyConcreteBottleInputError)) throw error;
    throw new InvalidPriceMatchConcreteBottleInputError(error.message, {
      cause: error,
    });
  }
}
