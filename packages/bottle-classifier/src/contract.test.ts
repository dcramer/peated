import { describe, expect, test } from "vitest";
import {
  BottleClassificationResultSchema,
  ClassifyBottleReferenceInputSchema,
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  isIgnoredBottleClassification,
} from "./contract";

describe("bottle-classifier contract", () => {
  test("parses the generic classifier input shape", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        id: "listing-1",
        name: "Glenmorangie Quinta Ruban 14-year-old",
        url: "https://example.com/products/quinta-ruban",
        currentBottleId: null,
        currentReleaseId: null,
      },
    });

    expect(parsed.reference.name).toBe("Glenmorangie Quinta Ruban 14-year-old");
    expect(parsed.candidateExpansion).toBe("open");
  });

  test("parses closed-set candidate expansion mode", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Warehouse Session (Batch 2)",
      },
      candidateExpansion: "initial_only",
    });

    expect(parsed.candidateExpansion).toBe("initial_only");
  });

  test("parses optional image evidence on classifier input", () => {
    const parsed = ClassifyBottleReferenceInputSchema.parse({
      reference: {
        name: "Ardbeg Uigeadail",
      },
      extractedIdentity: {
        brand: "Ardbeg",
        expression: "Uigeadail",
      },
      imageEvidence: {
        sourceImageId: "pending-upload-1",
        extractors: [
          {
            kind: "ocr",
            confidence: 0.86,
            textSpans: [{ text: "Uigeadail", confidence: 0.91 }],
          },
        ],
        fieldCandidates: {
          brand: { value: "Ardbeg", confidence: 0.96 },
        },
        photoSuitability: {
          isSingleBottlePhoto: true,
          labelReadable: true,
          suitableAsTastingImage: true,
          suitableAsBottleImage: true,
        },
      },
      candidateExpansion: "initial_only",
    });

    expect(parsed.imageEvidence?.fieldCandidates.brand?.value).toBe("Ardbeg");
    expect(parsed.extractedIdentity?.category).toBeNull();
  });

  test("builds discriminated results with normalized artifacts", () => {
    const ignored = createIgnoredBottleClassification({
      reason: "non-whisky",
      artifacts: {},
    });
    const classified = createDecidedBottleClassification({
      decision: {
        action: "no_match",
        confidence: 72,
        rationale: "Not enough identity evidence.",
        candidateBottleIds: [],
        identityScope: "product",
        observation: null,
        matchedBottleId: null,
        matchedReleaseId: null,
        parentBottleId: null,
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        imageEvidence: {
          sourceImageId: "pending-upload-1",
          extractors: [
            {
              kind: "vision",
              confidence: 0.8,
              textSpans: [],
              observations: [],
            },
          ],
          fieldCandidates: {},
          photoSuitability: {
            isSingleBottlePhoto: true,
            labelReadable: true,
            suitableAsTastingImage: true,
            suitableAsBottleImage: false,
          },
          conflicts: [],
        },
        candidates: [],
      },
    });

    expect(isIgnoredBottleClassification(ignored)).toBe(true);
    expect(BottleClassificationResultSchema.parse(classified)).toMatchObject({
      status: "classified",
      artifacts: {
        imageEvidence: {
          sourceImageId: "pending-upload-1",
        },
        candidates: [],
        searchEvidence: [],
      },
    });
  });
});
