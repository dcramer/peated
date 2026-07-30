import { describe, expect, test } from "vitest";

import { buildContextImageEvidence } from "./contextImageEvidence";

describe("buildContextImageEvidence", () => {
  test("normalizes extracted identity into field-level evidence", () => {
    const evidence = buildContextImageEvidence({
      sourceImageId: "tasting:901",
      model: "test-model",
      extractedIdentity: {
        brand: "Laphroaig",
        bottler: null,
        expression: "Càirdeas",
        series: "Càirdeas",
        distillery: ["Laphroaig"],
        category: "single_malt",
        stated_age: null,
        abv: 52.2,
        release_year: 2022,
        vintage_year: null,
        cask_strength: true,
        single_cask: false,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        edition: "Warehouse 1",
      },
    });

    expect(evidence).toMatchObject({
      sourceImageId: "tasting:901",
      extractors: [{ kind: "vision", model: "test-model" }],
      fieldCandidates: {
        brand: { value: "Laphroaig", sourceExtractorIndexes: [0] },
        releaseYear: { value: 2022, sourceExtractorIndexes: [0] },
        caskStrength: { value: true, sourceExtractorIndexes: [0] },
        singleCask: { value: false, sourceExtractorIndexes: [0] },
      },
    });
  });

  test("returns explicit no-evidence output after an unreadable image", () => {
    expect(
      buildContextImageEvidence({
        sourceImageId: "bottle:10",
        model: "test-model",
        extractedIdentity: null,
      }),
    ).toMatchObject({
      sourceImageId: "bottle:10",
      extractors: [
        {
          confidence: 0,
          textSpans: [],
          observations: [
            "No reliable Bottle identity was read from the public image.",
          ],
        },
      ],
      fieldCandidates: {},
      photoSuitability: {
        labelReadable: false,
        suitableAsBottleImage: false,
      },
    });
  });
});
