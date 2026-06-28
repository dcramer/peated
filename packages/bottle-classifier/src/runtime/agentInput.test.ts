import { describe, expect, test } from "vitest";
import type { BottleCandidate } from "../classifierTypes";
import { buildAgentInput } from "./agentInput";

function buildCandidate(candidate: Partial<BottleCandidate>): BottleCandidate {
  return {
    kind: "bottle",
    bottleId: 100,
    releaseId: null,
    alias: "Example Parent",
    fullName: "Example Parent",
    bottleFullName: "Example Parent",
    brand: "Example",
    bottler: null,
    series: null,
    distillery: [],
    category: "single_malt",
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
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
              parentBottleReleaseTraits: ["statedAge"],
              childReleaseCount: 1,
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
              siblingReleases: [
                {
                  releaseId: 9001,
                  fullName: "Shieldaig Speyside 18-year-old",
                  traitFields: ["statedAge"],
                  statedAge: 18,
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
              parentBottleReleaseTraits: [],
              childReleaseCount: 0,
              siblingBottles: [],
              siblingReleases: [],
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
      parentBottleReleaseTraits: ["statedAge"],
      childReleaseCount: 1,
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
      siblingReleases: [
        {
          releaseId: 9001,
          fullName: "Shieldaig Speyside 18-year-old",
          traitFields: ["statedAge"],
          statedAge: 18,
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
});
