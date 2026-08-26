import { describe, expect, test } from "vitest";
import { buildBottleProposalDraft } from "./bottleProposalDraft";

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

describe("buildBottleProposalDraft", () => {
  test("uses the shared source name with exact source fields", () => {
    const draft = buildBottleProposalDraft({
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
    const draft = buildBottleProposalDraft({
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
    const draft = buildBottleProposalDraft({
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
      caskNumber: "#5678" as const,
      maturation: "Bourbon barrel" as const,
      outturn: 240 as const,
      description: "Source description",
      descriptionSrc: "user" as const,
      tastingNotes: {
        nose: "Source nose",
        palate: "Source palate",
        finish: "Source finish",
      },
    };

    const draft = buildBottleProposalDraft({
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
      caskNumber: "#5678",
      maturation: "Bourbon barrel",
      outturn: 240,
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

  test("uses one proposed Bottle for stable and exact evidence", () => {
    expect(
      buildBottleProposalDraft({
        sourceBottle,
        proposedBottle: {
          name: "18-year-old",
          statedAge: 18,
          brand: { id: 20, name: "Proposed Brand" },
          edition: "Cask 42",
          abv: null,
          releaseYear: 2025,
        },
      }),
    ).toMatchObject({
      name: "18-year-old",
      statedAge: 18,
      category: "single_malt",
      brand: { id: 20, name: "Proposed Brand" },
      distillers: [{ id: 11, name: "Example Distillery" }],
      edition: "Cask 42",
      abv: null,
      releaseYear: 2025,
    });
  });

  test("falls back to source values only when proposed Bottle fields are absent", () => {
    expect(
      buildBottleProposalDraft({
        sourceBottle,
        proposedBottle: {
          name: "18-year-old",
          statedAge: 18,
          brand: { id: 20, name: "Proposed Brand" },
          edition: "Bottle Edition",
          abv: null,
          releaseYear: 2024,
        },
      }),
    ).toMatchObject({
      name: "18-year-old",
      statedAge: 18,
      brand: { id: 20, name: "Proposed Brand" },
      edition: "Bottle Edition",
      abv: null,
      releaseYear: 2024,
      category: "single_malt",
      distillers: [{ id: 11, name: "Example Distillery" }],
    });
  });

  test.each([
    {
      name: "proposed Bottle-selected description",
      proposedBottle: {
        description: "Bottle description",
        descriptionSrc: "user" as const,
      },
      expected: { description: "Bottle description", descriptionSrc: "user" },
    },
    {
      name: "source-selected description",
      proposedBottle: {
        descriptionSrc: "generated" as const,
      },
      expected: { description: "Source description", descriptionSrc: "user" },
    },
  ])("tracks $name provenance", ({ proposedBottle, expected }) => {
    expect(
      buildBottleProposalDraft({
        sourceBottle: {
          ...sourceBottle,
          description: "Source description",
          descriptionSrc: "user",
        },
        proposedBottle,
      }),
    ).toMatchObject(expected);
  });
});
