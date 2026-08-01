import { describe, expect, test } from "vitest";
import type { BottleContext } from "../bottleContextContract";
import type { BottleCandidate } from "../classifierTypes";
import { buildAgentInput, buildAuditBottleAgentInput } from "./agentInput";

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

function buildBottleContext(): BottleContext {
  return {
    bottleId: 45146,
    fullName: "Laphroaig Càirdeas 2022 Warehouse 1",
    groupId: 320,
    shared: {
      name: "Càirdeas",
      statedAge: null,
      series: { seriesId: 71, name: "Càirdeas" },
      category: "single_malt",
      brand: { entityId: 9, name: "Laphroaig" },
      distillers: [{ entityId: 9, name: "Laphroaig" }],
      bottler: null,
    },
    exact: {
      edition: "Warehouse 1",
      statedAge: null,
      abv: 52.2,
      singleCask: false,
      caskStrength: true,
      vintageYear: null,
      releaseYear: 2022,
      caskSize: null,
      caskType: null,
      caskFill: null,
    },
    siblings: [],
    aliases: [{ name: "Laphroaig Cairdeas 2022", ignored: false }],
    observations: [],
    publicImages: [],
  };
}

describe("buildAgentInput", () => {
  test("serializes candidate family context without operation capabilities", () => {
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

  test("serializes a deterministic identity anchor without a phase handoff", () => {
    const input = JSON.parse(
      buildAgentInput({
        reference: { name: "SMWS 95.71" },
        extractedIdentity: null,
        initialCandidates: [],
        currentBottle: null,
        hasExactAliasMatch: false,
        candidateExpansion: "open",
        identityAnchor: {
          action: "match",
          rationale: "The SMWS code is a closed identity anchor.",
          candidateBottleIds: [95],
          identityScope: "exact_cask",
          aliasScope: "none",
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
          matchedBottleId: 95,
          proposedBottle: null,
        },
      }),
    );

    expect(input.identityAnchor).toMatchObject({
      action: "match",
      matchedBottleId: 95,
    });
    expect(input).not.toHaveProperty("phase");
  });
});

describe("buildAuditBottleAgentInput", () => {
  test("serializes server-owned audit context without a reference envelope", () => {
    const input = JSON.parse(
      buildAuditBottleAgentInput({
        audit: {
          bottleId: 45146,
          origin: "moderator",
          note: "Review the Brand assignment; this text is context only.",
        },
        currentBottleContext: buildBottleContext(),
      }),
    );

    expect(input).toMatchObject({
      intent: "audit_bottle",
      audit: {
        bottleId: 45146,
        origin: "moderator",
        note: "Review the Brand assignment; this text is context only.",
      },
      currentBottleContext: {
        bottleId: 45146,
        groupId: 320,
        exact: {
          releaseYear: 2022,
        },
        aliases: [
          {
            name: "Laphroaig Cairdeas 2022",
            ignored: false,
          },
        ],
      },
    });
    expect(input).not.toHaveProperty("reference");
  });
});
