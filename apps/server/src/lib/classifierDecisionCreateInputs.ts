import type { ProposedBottle } from "@peated/bottle-classifier/internal/types";
import {
  BottleCreateInputSchema,
  type BottleCreateInput,
} from "@peated/server/lib/bottleSchemas";
import type { BottleInputSchema } from "@peated/server/schemas";
import type { z } from "zod";

type RouteBottleInput = z.infer<typeof BottleInputSchema>;

function buildBottleEntityInput(
  choice: {
    id: number | null;
    name: string;
  },
  entityType: "brand" | "distiller" | "bottler",
): RouteBottleInput["brand"] {
  return (
    choice.id ?? {
      name: choice.name,
      type: [entityType],
      kind: null,
      ownerId: null,
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
): RouteBottleInput {
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
    naturalColor: null,
    nonChillFiltered: null,
    noAgeStatement: null,
  };
}

/**
 * Maps the classifier's one create action to independent Bottle
 * creation. Group assignment is automatic; classifier output never selects a
 * parent or existing group.
 */
export function buildClassifierBottleInput(
  proposedBottle: ProposedBottle,
): BottleCreateInput {
  const { imageUrl: _imageUrl, ...input } =
    buildBottleInputFromProposedBottle(proposedBottle);
  return BottleCreateInputSchema.parse(input);
}
