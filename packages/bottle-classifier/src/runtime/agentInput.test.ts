import { describe, expect, test } from "vitest";
import type { BottleCandidate } from "../classifierTypes";
import { buildAgentInput } from "./agentInput";

function buildCandidate(candidate: Partial<BottleCandidate>): BottleCandidate {
  return {
    bottleId: 100,
    alias: "Example Parent",
    fullName: "Example Parent",
    brand: "Example",
    bottler: null,
    series: null,
    distillery: [],
    category: "single_malt",
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    score: 1,
    source: ["exact"],
    ...candidate,
  };
}

describe("buildAgentInput", () => {
  test("serializes candidate family context for reasoning", () => {
    const input = JSON.parse(
      buildAgentInput({
        reference: {
          name: "Example Parent 21-year-old",
        },
        extractedIdentity: null,
        initialCandidates: [
          buildCandidate({
            bottleId: 44175,
            fullName: "Shieldaig Speyside",
            familyContext: {
              siblingBottles: [
                {
                  bottleId: 44176,
                  fullName: "Shieldaig Speyside 25-year-old",
                  traitFields: ["statedAge"],
                  statedAge: 25,
                  edition: null,
                  releaseYear: null,
                  vintageYear: null,
                  abv: null,
                  caskStrength: null,
                  singleCask: null,
                  caskType: null,
                  caskSize: null,
                  caskFill: null,
                },
              ],
            },
          }),
          buildCandidate({
            bottleId: 43912,
            fullName: "Shieldaig Highland",
            familyContext: {
              siblingBottles: [],
            },
          }),
        ],
        currentBottle: null,
        hasExactAliasMatch: false,
        candidateExpansion: "initial_only",
      }),
    );

    expect(input.localSearch).not.toHaveProperty("familyContextSummary");
    expect(input.localSearch.candidates[0].familyContext).toEqual({
      siblingBottles: [
        {
          bottleId: 44176,
          fullName: "Shieldaig Speyside 25-year-old",
          traitFields: ["statedAge"],
          statedAge: 25,
          edition: null,
          releaseYear: null,
          vintageYear: null,
          abv: null,
          caskStrength: null,
          singleCask: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
        },
      ],
    });
  });

  test("serializes image evidence for photo-backed reasoning", () => {
    const input = JSON.parse(
      buildAgentInput({
        reference: {
          name: "Ardbeg Uigeadail",
          imageUrl: "https://example.com/uploads/pending-uploads/photo.webp",
        },
        extractedIdentity: {
          brand: "Ardbeg",
          bottler: null,
          expression: "Uigeadail",
          series: null,
          distillery: [],
          category: null,
          stated_age: null,
          abv: 54.2,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          edition: null,
        },
        imageEvidence: {
          sourceImageId: "pending-upload-1",
          extractors: [
            {
              kind: "ocr",
              confidence: 0.86,
              textSpans: [{ text: "Uigeadail", confidence: 0.91 }],
              observations: [],
            },
          ],
          fieldCandidates: {
            expression: { value: "Uigeadail", confidence: 0.91 },
          },
          photoSuitability: {
            isSingleBottlePhoto: true,
            labelReadable: true,
            suitableAsTastingImage: true,
            suitableAsBottleImage: true,
          },
          conflicts: [],
        },
        initialCandidates: [],
        currentBottle: null,
        hasExactAliasMatch: false,
        candidateExpansion: "initial_only",
      }),
    );

    expect(input.imageEvidence.sourceImageId).toBe("pending-upload-1");
    expect(input.imageEvidence.fieldCandidates.expression.value).toBe(
      "Uigeadail",
    );
  });
});
