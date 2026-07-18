import {
  ConcreteBottleUpdateInputSchema,
  IndependentConcreteBottleCreateRouteInputSchema,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import type { BottleInputSchema } from "@peated/server/schemas";
import type { z } from "zod";

type FlatBottleInput = z.input<typeof BottleInputSchema>;

/**
 * Translates the retained flat Bottle input into the strict concrete create
 * route contract without carrying legacy response or image fields forward.
 */
export function buildIndependentConcreteBottleRouteInput(
  input: FlatBottleInput,
) {
  return IndependentConcreteBottleCreateRouteInputSchema.parse({
    name: input.name,
    statedAge: input.statedAge,
    series: input.series,
    category: input.category,
    brand: input.brand,
    distillers: input.distillers,
    bottler: input.bottler,
    flavorProfile: input.flavorProfile,
    edition: input.edition,
    abv: input.abv,
    singleCask: input.singleCask,
    caskStrength: input.caskStrength,
    vintageYear: input.vintageYear,
    releaseYear: input.releaseYear,
    caskSize: input.caskSize,
    caskType: input.caskType,
    caskFill: input.caskFill,
    description: input.description,
    descriptionSrc: input.descriptionSrc,
    tastingNotes: input.tastingNotes,
  });
}

/** Maps a parsed flat upsert input to the canonical shared/exact patch. */
export function buildConcreteBottleUpdatePatch(
  input: ReturnType<typeof buildIndependentConcreteBottleRouteInput>,
): ConcreteBottleUpdateInput {
  return ConcreteBottleUpdateInputSchema.parse({
    shared: {
      name: input.name,
      statedAge: input.statedAge,
      series: input.series,
      category: input.category,
      brand: input.brand,
      distillers: input.distillers,
      bottler: input.bottler,
      flavorProfile: input.flavorProfile,
    },
    exact: {
      edition: input.edition,
      abv: input.abv,
      singleCask: input.singleCask,
      caskStrength: input.caskStrength,
      vintageYear: input.vintageYear,
      releaseYear: input.releaseYear,
      caskSize: input.caskSize,
      caskType: input.caskType,
      caskFill: input.caskFill,
      description: input.description,
      descriptionSrc: input.descriptionSrc,
      tastingNotes: input.tastingNotes,
    },
  });
}
