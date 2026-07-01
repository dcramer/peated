import { describe, expect, test } from "vitest";
import type {
  BottleClassificationDecision,
  BottleExtractedDetails,
} from "./classifierTypes";
import { inferBottleIdentityScope } from "./exactCaskPolicy";

const baseExtractedIdentity: BottleExtractedDetails = {
  brand: "Example",
  bottler: null,
  expression: "Private Cask",
  series: null,
  distillery: [],
  category: "single_malt",
  stated_age: null,
  abv: null,
  release_year: null,
  vintage_year: null,
  cask_strength: null,
  single_cask: true,
  edition: null,
};

const baseProposedBottle: NonNullable<
  BottleClassificationDecision["proposedBottle"]
> = {
  name: "Private Cask",
  series: null,
  category: "single_malt",
  edition: null,
  statedAge: null,
  caskStrength: null,
  singleCask: true,
  abv: null,
  vintageYear: null,
  releaseYear: null,
  brand: {
    id: null,
    name: "Example",
  },
  distillers: [],
  bottler: null,
};

describe("inferBottleIdentityScope", () => {
  test("does not promote non-SMWS cask wording into exact-cask scope", () => {
    expect(
      inferBottleIdentityScope({
        requestedIdentityScope: null,
        reference: {
          name: "Example Private Cask No. 123",
        },
        proposedBottle: baseProposedBottle,
        extractedIdentity: baseExtractedIdentity,
        hasReleaseIdentity: false,
        observation: {
          caskNumber: "123",
          barrelNumber: null,
          bottleNumber: null,
          outturn: null,
          market: null,
          exclusive: null,
          selector: null,
        },
      }),
    ).toBe("product");
  });

  test("keeps explicit exact-cask scope when the agent supplied cask signals", () => {
    expect(
      inferBottleIdentityScope({
        requestedIdentityScope: "exact_cask",
        reference: {
          name: "Example Private Cask No. 123",
        },
        proposedBottle: baseProposedBottle,
        extractedIdentity: baseExtractedIdentity,
        hasReleaseIdentity: false,
        observation: {
          caskNumber: "123",
          barrelNumber: null,
          bottleNumber: null,
          outturn: null,
          market: null,
          exclusive: null,
          selector: null,
        },
      }),
    ).toBe("exact_cask");
  });

  test("keeps explicit SMWS exact-cask scope when a code is present", () => {
    expect(
      inferBottleIdentityScope({
        requestedIdentityScope: "exact_cask",
        reference: {
          name: "SMWS 6.71",
        },
        proposedBottle: {
          ...baseProposedBottle,
          name: "6.71",
          brand: {
            id: null,
            name: "The Scotch Malt Whisky Society",
          },
        },
        extractedIdentity: {
          ...baseExtractedIdentity,
          brand: "The Scotch Malt Whisky Society",
          expression: "6.71",
        },
        hasReleaseIdentity: false,
        observation: null,
      }),
    ).toBe("exact_cask");
  });

  test("downgrades explicit SMWS exact-cask scope when no code is present", () => {
    expect(
      inferBottleIdentityScope({
        requestedIdentityScope: "exact_cask",
        reference: {
          name: "SMWS single cask bottling",
        },
        proposedBottle: {
          ...baseProposedBottle,
          name: "Single Cask Bottling",
          brand: {
            id: null,
            name: "The Scotch Malt Whisky Society",
          },
        },
        extractedIdentity: {
          ...baseExtractedIdentity,
          brand: "The Scotch Malt Whisky Society",
          expression: "Single Cask Bottling",
        },
        hasReleaseIdentity: false,
        observation: null,
      }),
    ).toBe("product");
  });

  test("downgrades explicit exact-cask scope when signals are missing", () => {
    expect(
      inferBottleIdentityScope({
        requestedIdentityScope: "exact_cask",
        reference: {
          name: "Example Single Barrel",
        },
        proposedBottle: baseProposedBottle,
        extractedIdentity: {
          ...baseExtractedIdentity,
          expression: "Single Barrel",
        },
        hasReleaseIdentity: false,
        observation: null,
      }),
    ).toBe("product");
  });
});
