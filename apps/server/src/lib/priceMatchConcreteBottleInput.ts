import type { ConcreteBottleCreateInput } from "@peated/server/lib/concreteBottleSchemas";
import {
  buildLegacyConcreteBottleInput,
  InvalidLegacyConcreteBottleInputError,
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
}: {
  bottleInput?: LegacyBottleInput;
  releaseInput?: LegacyBottleReleaseInput;
  parentBottleId: number | null;
}): {
  creationTarget: "bottle" | "release" | "bottle_and_release";
  input: ConcreteBottleCreateInput;
} {
  try {
    return buildLegacyConcreteBottleInput({
      bottleInput,
      releaseInput,
      parentBottleId,
      source: "price-match",
    });
  } catch (error) {
    if (!(error instanceof InvalidLegacyConcreteBottleInputError)) throw error;
    throw new InvalidPriceMatchConcreteBottleInputError(error.message, {
      cause: error,
    });
  }
}
