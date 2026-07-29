import type { ProposedBottle } from "@peated/bottle-classifier/internal/types";
import type { ConcreteBottleCreateInput } from "@peated/server/lib/concreteBottleSchemas";
import type { BottleInputSchema } from "@peated/server/schemas";
import type { z } from "zod";

type BottleCreateInput = z.infer<typeof BottleInputSchema>;

function buildBottleEntityInput(
  choice: {
    id: number | null;
    name: string;
  },
  entityType: "brand" | "distiller" | "bottler",
): BottleCreateInput["brand"] {
  return (
    choice.id ?? {
      name: choice.name,
      type: [entityType],
      description: null,
      shortName: null,
      location: null,
      address: null,
      yearEstablished: null,
      website: null,
      country: null,
      region: null,
    }
  );
}

/**
 * Classifier create decisions carry normalized draft entities, but the create
 * routes still accept the regular bottle input shape. This adapter keeps that
 * translation in one place so every classifier consumer persists drafts the
 * same way.
 */
export function buildBottleInputFromProposedBottle(
  proposedBottle: ProposedBottle,
): BottleCreateInput {
  return {
    ...proposedBottle,
    series: proposedBottle.series
      ? (proposedBottle.series.id ?? {
          name: proposedBottle.series.name,
          description: null,
        })
      : null,
    brand: buildBottleEntityInput(proposedBottle.brand, "brand"),
    distillers: proposedBottle.distillers.map((distiller) =>
      buildBottleEntityInput(distiller, "distiller"),
    ),
    bottler: proposedBottle.bottler
      ? buildBottleEntityInput(proposedBottle.bottler, "bottler")
      : null,
    description: null,
    descriptionSrc: null,
    imageUrl: null,
    flavorProfile: null,
  };
}

/**
 * Maps the classifier's one create action to independent concrete Bottle
 * creation. Group assignment is automatic; classifier output never selects a
 * parent or existing group.
 */
export function buildClassifierConcreteBottleInput(
  proposedBottle: ProposedBottle,
): ConcreteBottleCreateInput {
  const input = buildBottleInputFromProposedBottle(proposedBottle);
  return {
    stable: {
      name: input.name,
      statedAge: null,
      series: input.series,
      category: input.category,
      brand: input.brand,
      distillers: input.distillers,
      bottler: input.bottler,
      flavorProfile: input.flavorProfile,
    },
    exact: {
      edition: input.edition,
      statedAge: input.statedAge,
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
  };
}
