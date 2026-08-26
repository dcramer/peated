import { describe, expect, test } from "vitest";

import type { BottleContext } from "../bottleContextContract";
import { findUnsupportedPopulatedBottlePatchField } from "./bottlePatchEvidence";

function bottleContext({
  abv = 53,
  imageAbvs = [],
  observationAbv,
}: {
  abv?: number | null;
  imageAbvs?: number[];
  observationAbv?: number;
} = {}): BottleContext {
  return {
    bottleId: 45453,
    fullName: "Example Bottle - 53.0% ABV",
    groupId: 18413,
    shared: {
      name: "Example Bottle",
      statedAge: null,
      series: null,
      category: "single_malt",
      brand: { entityId: 1, name: "Example Brand" },
      distillers: [{ entityId: 2, name: "Example Distillery" }],
      bottler: null,
    },
    exact: {
      edition: "Cask 173445",
      statedAge: null,
      abv,
      singleCask: true,
      caskStrength: true,
      vintageYear: 2007,
      releaseYear: 2024,
      caskNumber: "#3456",
      maturation: "Other cask",
      outturn: 180,
    },
    siblings: [],
    aliases: [],
    observations:
      observationAbv === undefined
        ? []
        : [
            {
              sourceType: "producer_factsheet",
              sourceKey: "example-bottle",
              sourceName: "Example Bottle factsheet",
              sourceUrl: "https://example.com/bottle",
              rawText: `Bottled at ${observationAbv}% ABV`,
              parsedIdentity: { abv: observationAbv },
              facts: null,
            },
          ],
    publicImages: imageAbvs.map((imageAbv, index) => ({
      source:
        index === 0
          ? { kind: "bottle" as const }
          : { kind: "tasting" as const, tastingId: index },
      url: `https://example.com/bottle-${index}.webp`,
      labelEvidence: {
        sourceImageId: `image:${index}`,
        model: "test-model",
        extractedIdentity: {
          brand: "Example Brand",
          bottler: null,
          expression: "Example Bottle",
          series: null,
          distillery: ["Example Distillery"],
          category: "single_malt",
          stated_age: null,
          abv: imageAbv,
          release_year: 2024,
          vintage_year: 2007,
          cask_strength: true,
          single_cask: true,
          maturation: "Other cask",
          cask_number: "#3456",
          outturn: 180,
          edition: "Cask 7445",
        },
        rawLabelText: null,
      },
    })),
  };
}

describe("populated Bottle patch evidence", () => {
  test("rejects a populated-field replacement supported by only one image extraction", () => {
    expect(
      findUnsupportedPopulatedBottlePatchField({
        context: bottleContext({ imageAbvs: [56.4] }),
        patch: { abv: 56.4 },
      }),
    ).toBe("abv");
  });

  test("accepts matching structured support for a replacement", () => {
    expect(
      findUnsupportedPopulatedBottlePatchField({
        context: bottleContext({
          imageAbvs: [56.4],
          observationAbv: 56.4,
        }),
        patch: { abv: 56.4 },
      }),
    ).toBeNull();
  });

  test("accepts two agreeing image extractions and one image for a missing field", () => {
    expect(
      findUnsupportedPopulatedBottlePatchField({
        context: bottleContext({ imageAbvs: [56.4, 56.4] }),
        patch: { abv: 56.4 },
      }),
    ).toBeNull();
    expect(
      findUnsupportedPopulatedBottlePatchField({
        context: bottleContext({ abv: null, imageAbvs: [56.4] }),
        patch: { abv: 56.4 },
      }),
    ).toBeNull();
  });

  test("checks every populated field in a mixed patch", () => {
    expect(
      findUnsupportedPopulatedBottlePatchField({
        context: bottleContext({ observationAbv: 56.4 }),
        patch: { abv: 56.4, edition: "Cask 7445" },
      }),
    ).toBe("edition");
  });
});
