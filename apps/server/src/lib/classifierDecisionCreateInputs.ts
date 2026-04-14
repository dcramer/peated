import type {
  ProposedBottle,
  ProposedRelease,
} from "@peated/bottle-classifier/internal/types";
import type {
  BottleInputSchema,
  BottleReleaseInputSchema,
} from "@peated/server/schemas";
import type { z } from "zod";

type BottleCreateInput = z.infer<typeof BottleInputSchema>;
type BottleReleaseCreateInput = z.infer<typeof BottleReleaseInputSchema>;

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
 * Proposed releases already mirror the persisted release schema closely. The
 * remaining normalization here is just to fill nullable fields the route layer
 * still requires explicitly.
 */
export function buildBottleReleaseInputFromProposedRelease(
  proposedRelease: ProposedRelease,
): BottleReleaseCreateInput {
  return {
    ...proposedRelease,
    description: proposedRelease.description ?? null,
    imageUrl: proposedRelease.imageUrl ?? null,
    tastingNotes: proposedRelease.tastingNotes ?? null,
  };
}

/**
 * Convert a reviewed classifier decision into bottle and/or release create
 * inputs. Non-create decisions intentionally map to no inputs so callers must
 * handle matches and no-match results explicitly.
 */
export function buildClassifierCreateInputs(decision: {
  action: string;
  proposedBottle?: ProposedBottle | null;
  proposedRelease?: ProposedRelease | null;
}): {
  input?: BottleCreateInput;
  releaseInput?: BottleReleaseCreateInput;
} {
  if (decision.action === "create_bottle") {
    if (!decision.proposedBottle) {
      return {
        input: undefined,
        releaseInput: undefined,
      };
    }

    return {
      input: buildBottleInputFromProposedBottle(decision.proposedBottle),
      releaseInput: undefined,
    };
  }

  if (decision.action === "create_release") {
    if (!decision.proposedRelease) {
      return {
        input: undefined,
        releaseInput: undefined,
      };
    }

    return {
      input: undefined,
      releaseInput: buildBottleReleaseInputFromProposedRelease(
        decision.proposedRelease,
      ),
    };
  }

  if (decision.action === "create_bottle_and_release") {
    if (!decision.proposedBottle || !decision.proposedRelease) {
      return {
        input: undefined,
        releaseInput: undefined,
      };
    }

    return {
      input: buildBottleInputFromProposedBottle(decision.proposedBottle),
      releaseInput: buildBottleReleaseInputFromProposedRelease(
        decision.proposedRelease,
      ),
    };
  }

  return {
    input: undefined,
    releaseInput: undefined,
  };
}
