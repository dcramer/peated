import { describe, expect, test } from "vitest";
import { buildIndependentBottleProposalDraft } from "./independentBottleProposal";

const sourceBottle = {
  name: "16-year-old",
  statedAge: 16,
  category: "single_malt" as const,
  brand: { id: 10, name: "Example" },
  distillers: [{ id: 11, name: "Example Distillery" }],
  edition: "Core Release",
  abv: 43,
  releaseYear: 2020,
};

describe("buildIndependentBottleProposalDraft", () => {
  test("uses the shared source name with exact source fields", () => {
    const draft = buildIndependentBottleProposalDraft({
      sourceBottle: {
        ...sourceBottle,
        name: "16-year-old - Distillers Edition",
      },
      sourceSharedName: "16-year-old",
    });

    expect(draft).toMatchObject({
      name: "16-year-old",
      edition: "Core Release",
      abv: 43,
      releaseYear: 2020,
    });
  });

  test("keeps a proposed Bottle name ahead of the shared source name", () => {
    const draft = buildIndependentBottleProposalDraft({
      sourceBottle: {
        ...sourceBottle,
        name: "16-year-old - Distillers Edition",
      },
      sourceSharedName: "16-year-old",
      proposedBottle: { name: "Proposed Expression" },
    });

    expect(draft.name).toBe("Proposed Expression");
  });

  test("inherits serialized null stable evidence but preserves non-null and empty-list values", () => {
    const draft = buildIndependentBottleProposalDraft({
      sourceBottle: {
        name: "Source Name",
        statedAge: 16,
        series: { id: 1, name: "Source Series" },
        category: "single_malt",
        brand: { id: 2, name: "Source Brand" },
        distillers: [{ id: 3, name: "Source Distillery" }],
        bottler: { id: 4, name: "Source Bottler" },
        flavorProfile: "peated",
      },
      proposedBottle: {
        name: "Proposed Name",
        statedAge: null,
        series: null,
        category: null,
        brand: null,
        distillers: [],
        bottler: null,
      },
    });

    expect(draft).toMatchObject({
      name: "Proposed Name",
      statedAge: 16,
      series: { id: 1, name: "Source Series" },
      category: "single_malt",
      brand: { id: 2, name: "Source Brand" },
      distillers: [],
      bottler: { id: 4, name: "Source Bottler" },
      flavorProfile: "peated",
    });
  });

  test("selects editable fields without carrying source authority", () => {
    const source = {
      id: 101,
      groupId: 202,
      group: { id: 202 },
      targetId: 303,
      imageUrl: "https://example.com/source.jpg",
      stats: { total: 42 },
      totalTastings: 42,
      name: "12-year-old",
      statedAge: 12,
      series: { id: 1, name: "Core Range" },
      category: "single_malt" as const,
      brand: { id: 2, name: "Example" },
      distillers: [{ id: 3, name: "Example Distillery" }],
      bottler: { id: 4, name: "Example Bottler" },
      flavorProfile: "peated" as const,
      edition: "Batch 1",
      abv: 55.4,
      singleCask: true,
      caskStrength: true,
      vintageYear: 2008,
      releaseYear: 2021,
      caskSize: "hogshead" as const,
      caskType: "bourbon" as const,
      caskFill: "1st_fill" as const,
      description: "Source description",
      descriptionSrc: "user" as const,
      tastingNotes: {
        nose: "Source nose",
        palate: "Source palate",
        finish: "Source finish",
      },
    };

    const draft = buildIndependentBottleProposalDraft({
      sourceBottle: source,
    });

    expect(draft).toMatchObject({
      name: "12-year-old",
      statedAge: 12,
      series: { id: 1, name: "Core Range" },
      category: "single_malt",
      brand: { id: 2, name: "Example" },
      distillers: [{ id: 3, name: "Example Distillery" }],
      bottler: { id: 4, name: "Example Bottler" },
      flavorProfile: "peated",
      edition: "Batch 1",
      abv: 55.4,
      singleCask: true,
      caskStrength: true,
      vintageYear: 2008,
      releaseYear: 2021,
      caskSize: "hogshead",
      caskType: "bourbon",
      caskFill: "1st_fill",
      description: "Source description",
      descriptionSrc: "user",
      tastingNotes: {
        nose: "Source nose",
        palate: "Source palate",
        finish: "Source finish",
      },
    });
    for (const authorityField of [
      "id",
      "groupId",
      "group",
      "targetId",
      "imageUrl",
      "stats",
      "totalTastings",
    ]) {
      expect(draft).not.toHaveProperty(authorityField);
    }
  });

  test("keeps durable shared identity for release-only evidence", () => {
    expect(
      buildIndependentBottleProposalDraft({
        sourceBottle,
        proposedRelease: {
          statedAge: null,
          edition: "Cask 42",
          abv: null,
          releaseYear: 2025,
        },
      }),
    ).toMatchObject({
      name: "16-year-old",
      statedAge: 16,
      category: "single_malt",
      brand: { id: 10, name: "Example" },
      distillers: [{ id: 11, name: "Example Distillery" }],
      edition: "Cask 42",
      abv: null,
      releaseYear: 2025,
    });
  });

  test("keeps proposed Bottle age and exact fallbacks for combined evidence", () => {
    expect(
      buildIndependentBottleProposalDraft({
        sourceBottle,
        proposedBottle: {
          name: "18-year-old",
          statedAge: 18,
          brand: { id: 20, name: "Proposed Brand" },
          edition: "Bottle Edition",
          abv: 46,
          releaseYear: 2024,
        },
        proposedRelease: {
          statedAge: null,
          edition: "Release Edition",
          abv: null,
          releaseYear: null,
        },
      }),
    ).toMatchObject({
      name: "18-year-old",
      statedAge: 18,
      brand: { id: 20, name: "Proposed Brand" },
      edition: "Release Edition",
      abv: 46,
      releaseYear: 2024,
    });
  });

  test.each([
    {
      name: "release-selected description",
      proposedBottle: {
        description: "Bottle description",
        descriptionSrc: "user" as const,
      },
      proposedRelease: { description: "Release description" },
      expected: { description: "Release description", descriptionSrc: null },
    },
    {
      name: "proposed Bottle-selected description",
      proposedBottle: {
        description: "Bottle description",
        descriptionSrc: null,
      },
      proposedRelease: { description: null },
      expected: { description: "Bottle description", descriptionSrc: null },
    },
    {
      name: "source-selected description",
      proposedBottle: {
        descriptionSrc: "generated" as const,
      },
      proposedRelease: { description: null },
      expected: { description: "Source description", descriptionSrc: "user" },
    },
  ])(
    "tracks $name provenance",
    ({ proposedBottle, proposedRelease, expected }) => {
      expect(
        buildIndependentBottleProposalDraft({
          sourceBottle: {
            ...sourceBottle,
            description: "Source description",
            descriptionSrc: "user",
          },
          proposedBottle,
          proposedRelease,
        }),
      ).toMatchObject(expected);
    },
  );
});
