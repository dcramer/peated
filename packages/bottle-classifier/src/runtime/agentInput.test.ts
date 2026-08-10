import { describe, expect, test } from "vitest";
import type { BottleContext } from "../bottleContextContract";
import type { BottleCandidate } from "../classifierTypes";
import {
  buildAgentInput,
  buildAuditBottleAgentInput,
  buildDefaultBottleSearchInput,
} from "./agentInput";

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
  test("omits optional cask metadata from the default search without dropping cask flags", () => {
    expect(
      buildDefaultBottleSearchInput({
        reference: { name: "Example Distillery Reserve" },
        extractedIdentity: {
          brand: "Example Distillery",
          bottler: null,
          expression: "Reserve",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: true,
          single_cask: true,
          cask_type: "oloroso",
          cask_size: "hogshead",
          cask_fill: "1st_fill",
          edition: null,
        },
      }),
    ).toMatchObject({
      cask_strength: true,
      single_cask: true,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
    });
  });

  test("serializes candidate family context without operation capabilities", () => {
    const input = JSON.parse(
      buildAgentInput({
        reference: {
          id: "reference-44175",
          externalSiteId: 7,
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
        currentBottle: buildCandidate({
          bottleId: 500,
          fullName: "Current Bottle",
        }),
        hasExactAliasMatch: false,
        candidateExpansion: "initial_only",
      }),
    );

    expect(input.localSearch).not.toHaveProperty("familyContextSummary");
    expect(input.reference).not.toHaveProperty("id");
    expect(input.reference).not.toHaveProperty("externalSiteId");
    expect(input.currentBottle).not.toHaveProperty("score");
    expect(input.currentBottle).not.toHaveProperty("source");
    expect(input.localSearch.candidates[0]).not.toHaveProperty("score");
    expect(input.localSearch.candidates[0]).not.toHaveProperty("source");
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
    expect(input).not.toHaveProperty("availableSourceEvidenceFields");
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
  test("serializes audit context with the prepared reference evidence", () => {
    const input = JSON.parse(
      buildAuditBottleAgentInput({
        audit: {
          bottleId: 45146,
          origin: "moderator",
          note: "Review the Brand assignment; this text is context only.",
        },
        reference: {
          id: "audit:45146",
          externalSiteId: 7,
          name: "Laphroaig Càirdeas 2022 Warehouse 1",
          currentBottleId: 45146,
        },
        extractedIdentity: null,
        initialCandidates: [
          buildCandidate({
            bottleId: 45146,
            fullName: "Laphroaig Càirdeas 2022 Warehouse 1",
            brand: "Laphroaig",
          }),
        ],
        currentBottleContext: buildBottleContext(),
        availableSourceEvidenceFields: ["audit.note"],
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
      reference: {
        currentBottleId: 45146,
      },
      localSearch: {
        candidates: [{ bottleId: 45146 }],
      },
      availableSourceEvidenceFields: ["audit.note"],
    });
    expect(input.reference).not.toHaveProperty("id");
    expect(input.reference).not.toHaveProperty("externalSiteId");
    expect(input.localSearch.candidates[0]).not.toHaveProperty("score");
    expect(input.localSearch.candidates[0]).not.toHaveProperty("source");
    expect(input.extractedIdentity).toBeNull();
  });
});
