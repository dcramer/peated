import { describe, expect, test } from "vitest";

import {
  BottleContextLabelEvidenceSchema,
  BottleContextSchema,
  BottleContextSourceSchema,
  EntityContextSchema,
  MAX_BOTTLE_CONTEXT_ALIASES,
  MAX_BOTTLE_CONTEXT_IMAGES,
  MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH,
  MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH,
  MAX_BOTTLE_CONTEXT_OBSERVATIONS,
  MAX_BOTTLE_CONTEXT_SIBLINGS,
  MAX_ENTITY_CONTEXT_ALIASES,
  MAX_ENTITY_CONTEXT_BOTTLES,
  type BottleContextSource,
} from "./bottleContextContract";

const exact = {
  edition: null,
  statedAge: null,
  abv: null,
  singleCask: null,
  caskStrength: null,
  vintageYear: null,
  releaseYear: null,
  caskNumber: null,
  maturation: null,
  outturn: null,
};

function bottleSource(): BottleContextSource {
  return {
    bottleId: 10,
    fullName: "Example Bottle",
    groupId: 20,
    shared: {
      name: "Example",
      statedAge: null,
      series: null,
      category: "single_malt" as const,
      brand: { entityId: 30, name: "Example Brand" },
      distillers: [{ entityId: 31, name: "Example Distillery" }],
      bottler: null,
    },
    exact,
    siblings: [],
    aliases: [],
    observations: [],
    imageSources: [],
  };
}

describe("Bottle context contracts", () => {
  test("accepts only bounded public identity context", () => {
    const source = bottleSource();
    source.siblings = Array.from(
      { length: MAX_BOTTLE_CONTEXT_SIBLINGS },
      (_, index) => ({
        bottleId: 100 + index,
        fullName: `Sibling ${index}`,
        exact,
      }),
    );
    source.aliases = Array.from(
      { length: MAX_BOTTLE_CONTEXT_ALIASES },
      (_, index) => ({ name: `Alias ${index}`, ignored: false }),
    );
    source.observations = Array.from(
      { length: MAX_BOTTLE_CONTEXT_OBSERVATIONS },
      (_, index) => ({
        sourceType: "store_price",
        sourceKey: `listing:${index}`,
        sourceName: "Example Store",
        sourceUrl: `https://example.com/listing/${index}`,
        rawText: `Example Bottle ${index}`,
        parsedIdentity: null,
        facts: null,
      }),
    );
    source.imageSources = Array.from(
      { length: MAX_BOTTLE_CONTEXT_IMAGES },
      (_, index) => ({
        source: {
          kind: "tasting" as const,
          tastingId: 500 + index,
        },
        url: `https://example.com/images/${index}.webp`,
      }),
    );

    expect(BottleContextSourceSchema.parse(source)).toEqual(source);
  });

  test("rejects private or social fields instead of silently passing them on", () => {
    expect(
      BottleContextSourceSchema.safeParse({
        ...bottleSource(),
        notes: "private tasting note",
      }).success,
    ).toBe(false);
    expect(
      BottleContextSourceSchema.safeParse({
        ...bottleSource(),
        observations: [
          {
            sourceType: "store_price",
            sourceKey: "listing:1",
            sourceName: "Example Store",
            sourceUrl: null,
            rawText: null,
            parsedIdentity: null,
            facts: null,
            createdById: 99,
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("bounds observation text and structured data", () => {
    const observation = {
      sourceType: "store_price",
      sourceKey: "listing:1",
      sourceName: "Example Store",
      sourceUrl: null,
      rawText: "a".repeat(MAX_BOTTLE_CONTEXT_OBSERVATION_TEXT_LENGTH + 1),
      parsedIdentity: null,
      facts: null,
    };

    expect(
      BottleContextSourceSchema.safeParse({
        ...bottleSource(),
        observations: [observation],
      }).success,
    ).toBe(false);
    expect(
      BottleContextSourceSchema.safeParse({
        ...bottleSource(),
        observations: [
          {
            ...observation,
            rawText: null,
            facts: {
              value: "a".repeat(MAX_BOTTLE_CONTEXT_OBSERVATION_DATA_LENGTH + 1),
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("requires normalized evidence for every public image", () => {
    const { imageSources: _, ...source } = bottleSource();
    const evidence = BottleContextLabelEvidenceSchema.parse({
      sourceImageId: "bottle:10",
      model: "test-model",
      extractedIdentity: null,
    });
    expect(evidence).toEqual({
      sourceImageId: "bottle:10",
      model: "test-model",
      extractedIdentity: null,
      rawLabelText: null,
    });
    expect(
      BottleContextLabelEvidenceSchema.parse({
        ...evidence,
        rawLabelText: "Pokeno CASK NO 71 BOTTLE NO 100",
      }).rawLabelText,
    ).toBe("Pokeno CASK NO 71 BOTTLE NO 100");
    expect(
      BottleContextLabelEvidenceSchema.safeParse({
        ...evidence,
        confidence: 0.75,
        textSpans: [{ text: "synthetic label text", confidence: 0.75 }],
        photoSuitability: { suitableAsTastingImage: true },
      }).success,
    ).toBe(false);

    expect(
      BottleContextSchema.safeParse({
        ...source,
        publicImages: [
          {
            source: { kind: "bottle" },
            url: "https://example.com/bottle.webp",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      BottleContextSchema.parse({
        ...source,
        publicImages: [
          {
            source: { kind: "bottle" },
            url: "https://example.com/bottle.webp",
            labelEvidence: evidence,
          },
        ],
      }).publicImages,
    ).toHaveLength(1);
  });
});

describe("Entity context contract", () => {
  test("bounds aliases and related Bottle samples", () => {
    const context = {
      entityId: 30,
      name: "Example Brand",
      shortName: "Example",
      roles: ["brand" as const],
      website: "https://example.com",
      country: "Scotland",
      region: "Islay",
      yearEstablished: 1815,
      aliases: Array.from(
        { length: MAX_ENTITY_CONTEXT_ALIASES },
        (_, index) => `Alias ${index}`,
      ),
      relatedBottles: Array.from(
        { length: MAX_ENTITY_CONTEXT_BOTTLES },
        (_, index) => ({
          bottleId: 100 + index,
          fullName: `Bottle ${index}`,
          relationships: ["brand" as const],
        }),
      ),
    };

    expect(EntityContextSchema.parse(context)).toEqual(context);
    expect(
      EntityContextSchema.safeParse({
        ...context,
        description: "internal prose",
      }).success,
    ).toBe(false);
    expect(
      EntityContextSchema.safeParse({
        ...context,
        aliases: [...context.aliases, "One too many"],
      }).success,
    ).toBe(false);
  });
});
