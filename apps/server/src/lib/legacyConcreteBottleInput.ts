import {
  ConcreteBottleCreateInputSchema,
  type ConcreteBottleCreateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import type {
  BottleInputSchema,
  BottleReleaseInputSchema,
} from "@peated/server/schemas";
import type { z } from "zod";
import { ZodError } from "zod";

export type LegacyBottleInput = z.infer<typeof BottleInputSchema>;
export type LegacyBottleReleaseInput = z.infer<typeof BottleReleaseInputSchema>;
type IndependentConcreteBottleInput = Extract<
  ConcreteBottleCreateInput,
  { kind: "independent" }
>;
type ConcreteBottleExactInput = ConcreteBottleCreateInput["exact"];

export class InvalidLegacyConcreteBottleInputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidLegacyConcreteBottleInputError";
  }
}

function parseCanonicalInput(
  input: ConcreteBottleCreateInput,
  source: string,
): ConcreteBottleCreateInput {
  try {
    return ConcreteBottleCreateInputSchema.parse(input);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    const details = error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new InvalidLegacyConcreteBottleInputError(
      `Legacy ${source} input is not valid canonical Bottle data: ${details}`,
      { cause: error },
    );
  }
}

function assertCanonicalImageUrl(
  input: LegacyBottleInput | LegacyBottleReleaseInput | undefined,
  label: "bottle" | "release",
  source: string,
) {
  if (!input) return;

  if (input.imageUrl !== null && input.imageUrl !== undefined) {
    throw new InvalidLegacyConcreteBottleInputError(
      `Legacy ${source} ${label} imageUrl cannot be translated to canonical Bottle creation.`,
    );
  }
}

function buildStableInput(
  input: LegacyBottleInput,
): IndependentConcreteBottleInput["stable"] {
  return {
    name: input.name,
    statedAge: input.statedAge,
    series: input.series,
    category: input.category,
    brand: input.brand,
    distillers: input.distillers,
    bottler: input.bottler,
    flavorProfile: input.flavorProfile,
  };
}

function buildBottleExactInput(
  input: LegacyBottleInput,
): ConcreteBottleExactInput {
  return {
    edition: input.edition,
    // Bottle-only age belongs to stable/group identity, not the exact variant.
    statedAge: null,
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
  };
}

function buildReleaseExactInput(
  input: LegacyBottleReleaseInput,
): ConcreteBottleExactInput {
  return {
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
    descriptionSrc: null,
    tastingNotes: input.tastingNotes,
  };
}

function buildCombinedExactInput(
  bottle: LegacyBottleInput,
  release: LegacyBottleReleaseInput,
): ConcreteBottleExactInput {
  const description = release.description ?? bottle.description;
  const bottleDescriptionWins =
    release.description === null && bottle.description !== null;

  return {
    edition: release.edition ?? bottle.edition,
    // Release age is authoritative even when null; other exact traits may fall back.
    statedAge: release.statedAge,
    abv: release.abv ?? bottle.abv,
    singleCask: release.singleCask ?? bottle.singleCask,
    caskStrength: release.caskStrength ?? bottle.caskStrength,
    vintageYear: release.vintageYear ?? bottle.vintageYear,
    releaseYear: release.releaseYear ?? bottle.releaseYear,
    caskSize: release.caskSize ?? bottle.caskSize,
    caskType: release.caskType ?? bottle.caskType,
    caskFill: release.caskFill ?? bottle.caskFill,
    description,
    descriptionSrc: bottleDescriptionWins
      ? (bottle.descriptionSrc ?? null)
      : null,
    tastingNotes: release.tastingNotes ?? bottle.tastingNotes,
  };
}

/**
 * Translates retained Bottle/BottleRelease-shaped evidence into one canonical
 * concrete Bottle.
 */
export function buildLegacyConcreteBottleInput({
  bottleInput,
  releaseInput,
  parentBottleId,
  source,
}: {
  bottleInput?: LegacyBottleInput;
  releaseInput?: LegacyBottleReleaseInput;
  parentBottleId: number | null;
  source: string;
}): {
  creationTarget: "bottle" | "release" | "bottle_and_release";
  input: ConcreteBottleCreateInput;
} {
  assertCanonicalImageUrl(bottleInput, "bottle", source);
  assertCanonicalImageUrl(releaseInput, "release", source);

  if (bottleInput && !releaseInput) {
    if (parentBottleId !== null) {
      throw new InvalidLegacyConcreteBottleInputError(
        "Independent Bottle creation cannot include a parent Bottle id.",
      );
    }

    return {
      creationTarget: "bottle",
      input: parseCanonicalInput(
        {
          kind: "independent",
          stable: buildStableInput(bottleInput),
          exact: buildBottleExactInput(bottleInput),
        },
        source,
      ),
    };
  }

  if (releaseInput && !bottleInput) {
    if (
      parentBottleId === null ||
      !Number.isInteger(parentBottleId) ||
      parentBottleId <= 0
    ) {
      throw new InvalidLegacyConcreteBottleInputError(
        "Release creation requires a valid parent Bottle id.",
      );
    }

    return {
      creationTarget: "release",
      input: parseCanonicalInput(
        {
          kind: "source_bottle",
          sourceBottleId: parentBottleId,
          exact: buildReleaseExactInput(releaseInput),
        },
        source,
      ),
    };
  }

  if (!bottleInput || !releaseInput) {
    throw new InvalidLegacyConcreteBottleInputError(
      "Bottle or BottleRelease creation input is required.",
    );
  }

  if (parentBottleId !== null) {
    throw new InvalidLegacyConcreteBottleInputError(
      "Combined creation cannot include a parent Bottle id.",
    );
  }

  return {
    creationTarget: "bottle_and_release",
    input: parseCanonicalInput(
      {
        kind: "independent",
        stable: buildStableInput(bottleInput),
        exact: buildCombinedExactInput(bottleInput, releaseInput),
      },
      source,
    ),
  };
}
