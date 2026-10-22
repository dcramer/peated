import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";
import {
  applyPhotoProgress,
  EMPTY_PHOTO_PROGRESS,
  getCreateBottlePrefill,
  getCreateNameSeed,
  getLabelSummary,
  getManualResultCopy,
  getPhotoProgressStatus,
  type PhotoIdentification,
  type PhotoIdentificationProgressEvent,
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
        action: "create_bottle",
        proposedBottle: {
          name: "Canonical Expression",
          series: {
            id: 303,
            name: "Canonical Series",
          },
          category: "single_malt",
          statedAge: null,
          edition: "2024 Edition",
          abv: 48,
          caskStrength: null,
          singleCask: null,
          maturation: null,
          caskNumber: null,
          outturn: null,
          vintageYear: null,
          releaseYear: 2024,
          brand: {
            id: 101,
            name: "Canonical Brand",
          },
          bottler: {
            id: 404,
            name: "Canonical Bottler",
          },
          distillers: [
            {
              id: 202,
              name: "Existing Distillery",
            },
            {
              id: 203,
              name: "Second Distillery",
            },
          ],
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
        action: "create_bottle",
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
      distillers: [
        { id: 202, name: "Existing Distillery" },
        { id: 203, name: "Second Distillery" },
      ],
      bottlerId: 404,
      bottlerName: "Canonical Bottler",
      seriesId: 303,
      seriesName: "Canonical Series",
      edition: "2024 Edition",
      abv: 48,
      releaseYear: 2024,
    });
  });

  test("offers creation from extracted details when catalog candidates are uncertain", () => {
    const result = buildPhotoResult();
    result.classification = {
      status: "classified",
      decision: { action: "no_match" },
      artifacts: {
        candidates: [
          {
            fullName: "Possible Existing Bottle",
          },
        ],
      },
    };

    expect(getManualResultCopy(result)).toMatchObject({
      title: "We couldn't find this bottle",
      createLabel: "Add a new bottle",
      primaryAction: "create",
    });
    expect(getCreateBottlePrefill(result)).toMatchObject({
      brandName: "Raw Label Brand",
      category: "single_malt",
      distillers: [{ id: null, name: "Qualified Existing Distillery Co." }],
    });
  });
});

describe("photo identification progress", () => {
  test("collects each event and names the current step", () => {
    const result = buildPhotoResult();
    const events: PhotoIdentificationProgressEvent[] = [
      { type: "photo", pendingImage: result.pendingImage },
      { type: "label", imageEvidence: result.imageEvidence },
      { type: "candidates", bottles: [mockBottle] },
      { type: "step", step: "checking_web" },
    ];
    const statuses = [getPhotoProgressStatus(EMPTY_PHOTO_PROGRESS)];
    let progress = EMPTY_PHOTO_PROGRESS;
    for (const event of events) {
      progress = applyPhotoProgress(progress, event);
      statuses.push(getPhotoProgressStatus(progress));
    }

    expect(progress).toEqual({
      pendingImage: result.pendingImage,
      imageEvidence: result.imageEvidence,
      candidates: [mockBottle],
      step: "checking_web",
    });
    expect(statuses).toEqual([
      "Reading the label…",
      "Reading the label…",
      "Checking Peated…",
      "Checking Peated…",
      "Checking the web…",
    ]);
  });
});

describe("getLabelSummary", () => {
  test("joins the brand, name, age, and strength that were read", () => {
    const { imageEvidence } = buildPhotoResult();
    expect(
      getLabelSummary({
        ...imageEvidence,
        fieldCandidates: {
          brand: { value: "Beauchamp", confidence: 0.75 },
          expression: { value: "Single Malt", confidence: 0.75 },
          abv: { value: 46, confidence: 0.75 },
        },
      }),
    ).toBe("Beauchamp · Single Malt · 46% ABV");
    expect(
      getLabelSummary({ ...imageEvidence, fieldCandidates: {} }),
    ).toBeNull();
  });
});
