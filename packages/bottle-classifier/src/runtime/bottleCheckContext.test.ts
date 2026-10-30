import { describe, expect, test, vi } from "vitest";

import type { BottleContextSource } from "../bottleContextContract";
import { createTestLanguageModel } from "../testLanguageModel";
import {
  createBottleContextLoader,
  type ImageLabelReading,
  type ReadImageLabel,
} from "./bottleCheckContext";

function buildContextSource(): BottleContextSource {
  const exact = {
    edition: null,
    statedAge: 10,
    abv: 46,
    singleCask: false,
    caskStrength: false,
    vintageYear: null,
    releaseYear: null,
    releaseMonth: null,
    releaseDay: null,
    caskNumber: null,
    maturation: null,
    outturn: null,
  };
  return {
    bottleId: 1,
    fullName: "Example 10-year-old",
    groupId: 1,
    shared: {
      name: "10-year-old",
      statedAge: 10,
      series: null,
      category: "single_malt",
      brand: { entityId: 1, name: "Example" },
      distillers: [],
      bottler: null,
    },
    exact,
    siblings: [],
    references: [],
    observations: [],
    imageSources: [
      { source: { kind: "bottle" }, url: "https://example.com/bottle.webp" },
      {
        source: { kind: "tasting", tastingId: 7 },
        url: "https://example.com/tasting.webp",
      },
    ],
  };
}

function buildModel() {
  const { languageModel, generate } = createTestLanguageModel({
    result: null,
    rawLabelText: "EXAMPLE 10",
  });
  return { languageModel, create: generate };
}

describe("createBottleContextLoader", () => {
  test("keeps catalog facts without fetching or reading candidate images when disabled", async () => {
    const source = buildContextSource();
    source.references = [{ name: "Example Ten", ignored: false }];
    source.observations = [
      {
        sourceType: "store_price",
        sourceKey: "product-1",
        sourceName: "Example 10-year-old",
        sourceUrl: "https://example.com/product",
        rawText: "10 years old; 46% ABV",
        parsedIdentity: { stated_age: 10, abv: 46 },
        facts: null,
      },
    ];
    const readImageLabel = vi.fn<ReadImageLabel>();
    const getBottleContextImageInput = vi.fn(async (url: string) => url);
    const { languageModel, create } = buildModel();
    const loadBottleContext = createBottleContextLoader({
      dataSource: {
        getBottleContext: async () => source,
        getBottleContextImageInput,
        readImageLabel,
      },
      options: { languageModel, model: "test-model" },
      readImages: false,
    })!;

    const context = await loadBottleContext(1);

    expect(context).toMatchObject({
      bottleId: source.bottleId,
      shared: source.shared,
      exact: source.exact,
      references: source.references,
      observations: source.observations,
      siblings: source.siblings,
      publicImages: [],
    });
    expect(getBottleContextImageInput).not.toHaveBeenCalled();
    expect(readImageLabel).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("reads each image label once and reuses the saved reading", async () => {
    const saved = new Map<string, ImageLabelReading>();
    const readImageLabel = vi.fn<ReadImageLabel>(
      async ({ imageUrl, version, read }) => {
        const key = `${version}:${imageUrl}`;
        const existing = saved.get(key);
        if (existing) return existing;
        const reading = await read();
        saved.set(key, reading);
        return reading;
      },
    );
    const getBottleContextImageInput = vi.fn(
      async (url: string) => `data:image/webp;base64,${btoa(url)}`,
    );
    const { languageModel, create } = buildModel();
    const loadBottleContext = createBottleContextLoader({
      dataSource: {
        getBottleContext: async () => buildContextSource(),
        getBottleContextImageInput,
        readImageLabel,
      },
      options: { languageModel, model: "test-model" },
    })!;

    const first = await loadBottleContext(1);
    const second = await loadBottleContext(1);

    expect(create).toHaveBeenCalledTimes(2);
    expect(getBottleContextImageInput).toHaveBeenCalledTimes(2);
    expect(readImageLabel).toHaveBeenCalledTimes(4);
    expect(readImageLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: "https://example.com/bottle.webp",
        version: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(second?.publicImages).toEqual(first?.publicImages);
    expect(second?.publicImages[0]?.labelEvidence).toMatchObject({
      sourceImageId: "bottle:1",
      rawLabelText: "EXAMPLE 10",
    });
  });

  test("saves nothing when the label read fails", async () => {
    const saved = new Map<string, ImageLabelReading>();
    const { languageModel, create } = buildModel();
    create.mockRejectedValueOnce(new Error("provider down"));
    const loadBottleContext = createBottleContextLoader({
      dataSource: {
        getBottleContext: async () => buildContextSource(),
        readImageLabel: async ({ imageUrl, read }) => {
          const reading = await read();
          saved.set(imageUrl, reading);
          return reading;
        },
      },
      options: { languageModel, model: "test-model" },
    })!;

    const context = await loadBottleContext(1);

    expect(context?.publicImages[0]?.labelEvidence.rawLabelText).toBeNull();
    expect(saved.has("https://example.com/bottle.webp")).toBe(false);
    expect(saved.has("https://example.com/tasting.webp")).toBe(true);
  });
});
