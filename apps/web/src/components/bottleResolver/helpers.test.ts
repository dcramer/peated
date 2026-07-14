import { describe, expect, test } from "vitest";
import {
  canUseManualBottleCreate,
  getCreateBottlePrefill,
  getCreateNameSeed,
  type PhotoIdentification,
} from "./helpers";

function buildPhotoResult(): PhotoIdentification {
  return {
    pendingImage: {
      id: "pending-image",
      imageUrl: "https://api.example/uploads/watchpost.webp",
      expiresAt: new Date().toISOString(),
    },
    imageEvidence: {
      sourceImageId: "pending-image",
      extractors: [],
      fieldCandidates: {
        brand: {
          value: "Raw Label Brand",
          confidence: 0.9,
          sourceExtractorIndexes: [0],
        },
        distillery: {
          value: ["Qualified Existing Distillery Co."],
          confidence: 0.9,
          sourceExtractorIndexes: [0],
        },
        category: {
          value: "single_malt",
          confidence: 0.9,
          sourceExtractorIndexes: [0],
        },
      },
      photoSuitability: {
        isSingleBottlePhoto: true,
        labelReadable: true,
        suitableAsTastingImage: true,
        suitableAsBottleImage: true,
      },
      conflicts: [],
    },
    classification: {
      status: "classified",
      decision: {
        action: "create_bottle_and_release",
        proposedBottle: {
          name: "Canonical Expression",
          category: "single_malt",
          statedAge: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          brand: {
            id: 101,
            name: "Canonical Brand",
          },
          distillers: [
            {
              id: 202,
              name: "Existing Distillery",
            },
          ],
        },
        proposedRelease: {
          edition: "2024 Edition",
          statedAge: null,
          abv: 48,
          vintageYear: null,
          releaseYear: 2024,
        },
      },
      artifacts: {
        candidates: [],
      },
    },
    suggestedNextStep: "manual_search",
    diagnostics: {
      extraction: {
        status: "found",
        summary: "Raw label evidence",
      },
      candidates: {
        count: 0,
      },
      classification: {
        status: "classified",
        action: "create_bottle_and_release",
        confidence: null,
        reason: null,
      },
    },
    createToken: null,
  };
}

describe("photo create prefill", () => {
  test("prefers reviewed create fields over raw image extraction", () => {
    const result = buildPhotoResult();

    expect(getCreateNameSeed(result)).toBe("Canonical Expression");
    expect(getCreateBottlePrefill(result)).toMatchObject({
      brandId: 101,
      brandName: "Canonical Brand",
      category: "single_malt",
      distillerId: 202,
      distillerName: "Existing Distillery",
      edition: "2024 Edition",
      abv: 48,
      releaseYear: 2024,
    });
    expect(canUseManualBottleCreate(result)).toBe(false);
  });
});
