import type { BottleExtractedDetails } from "./classifierTypes";
import {
  ImageBottleEvidenceSchema,
  type ImageBottleEvidence,
} from "./imageEvidence";

function evidenceField<T extends boolean | number | string | string[]>(
  value: T | null | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return undefined;
  }

  return {
    value,
    confidence: 0.75,
    sourceExtractorIndexes: [0],
  };
}

export function buildContextImageEvidence({
  sourceImageId,
  model,
  extractedIdentity,
}: {
  sourceImageId: string;
  model: string;
  extractedIdentity: BottleExtractedDetails | null;
}): ImageBottleEvidence {
  const labelParts = [
    extractedIdentity?.brand,
    extractedIdentity?.expression,
    extractedIdentity?.series,
    ...(extractedIdentity?.distillery ?? []),
    extractedIdentity?.bottler,
    extractedIdentity?.edition,
    extractedIdentity?.stated_age == null
      ? null
      : `${extractedIdentity.stated_age} year old`,
    extractedIdentity?.abv == null ? null : `${extractedIdentity.abv}% ABV`,
    extractedIdentity?.vintage_year == null
      ? null
      : `${extractedIdentity.vintage_year} vintage`,
    extractedIdentity?.release_year == null
      ? null
      : `${extractedIdentity.release_year} release`,
  ].filter((value): value is string => Boolean(value));

  return ImageBottleEvidenceSchema.parse({
    sourceImageId,
    extractors: [
      {
        kind: "vision",
        model,
        confidence: extractedIdentity ? 0.75 : 0,
        textSpans: labelParts.length
          ? [{ text: labelParts.join(" "), confidence: 0.75 }]
          : [],
        observations: extractedIdentity
          ? ["Read Bottle identity from public catalog image evidence."]
          : ["No reliable Bottle identity was read from the public image."],
      },
    ],
    fieldCandidates: {
      brand: evidenceField(extractedIdentity?.brand),
      expression: evidenceField(extractedIdentity?.expression),
      series: evidenceField(extractedIdentity?.series),
      distillery: evidenceField(extractedIdentity?.distillery),
      bottler: evidenceField(extractedIdentity?.bottler),
      category: evidenceField(extractedIdentity?.category),
      statedAge: evidenceField(extractedIdentity?.stated_age),
      abv: evidenceField(extractedIdentity?.abv),
      vintageYear: evidenceField(extractedIdentity?.vintage_year),
      releaseYear: evidenceField(extractedIdentity?.release_year),
      edition: evidenceField(extractedIdentity?.edition),
      caskStrength: evidenceField(extractedIdentity?.cask_strength),
      singleCask: evidenceField(extractedIdentity?.single_cask),
      caskType: evidenceField(extractedIdentity?.cask_type),
      caskSize: evidenceField(extractedIdentity?.cask_size),
      caskFill: evidenceField(extractedIdentity?.cask_fill),
    },
    photoSuitability: {
      isSingleBottlePhoto: Boolean(extractedIdentity),
      labelReadable: Boolean(extractedIdentity),
      suitableAsTastingImage: true,
      suitableAsBottleImage: Boolean(extractedIdentity),
      reason: extractedIdentity
        ? null
        : "No reliable label identity was extracted from the public image.",
    },
    conflicts: [],
  });
}
