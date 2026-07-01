import { describe, expect, test } from "vitest";
import { createLocalCatalogDataSource } from ".";
import { BottleCandidateSearchInputSchema } from "../classifierTypes";
import { LocalCatalogSchema } from "./schema";

const shieldaigCatalog = LocalCatalogSchema.parse({
  entities: [{ id: 3943, name: "Shieldaig", type: ["brand"] }],
  bottles: [
    {
      id: 44175,
      name: "Speyside",
      fullName: "Shieldaig Speyside",
      brandId: 3943,
      category: "single_malt",
      statedAge: 18,
    },
    {
      id: 44266,
      name: "Speyside 30-year-old",
      fullName: "Shieldaig Speyside 30-year-old",
      brandId: 3943,
      category: "single_malt",
      statedAge: 30,
    },
  ],
  releases: [],
  aliases: [{ name: "Shieldaig Speyside", bottleId: 44175 }],
});

describe("local catalog data source", () => {
  test("rejects dangling catalog references", () => {
    const result = LocalCatalogSchema.safeParse({
      entities: [],
      bottles: [{ id: 1, name: "Speyside", brandId: 404 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["bottles", 0, "brandId"]);
    }
  });

  test("rejects entity references with the wrong role", () => {
    const result = LocalCatalogSchema.safeParse({
      entities: [{ id: 1, name: "Shieldaig", type: ["distiller"] }],
      bottles: [{ id: 1, name: "Speyside", brandId: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["bottles", 0, "brandId"],
        message: "Entity 1 is not a brand.",
      });
    }
  });

  test("rejects release aliases pointing at another bottle", () => {
    const result = LocalCatalogSchema.safeParse({
      entities: [{ id: 1, name: "Shieldaig", type: ["brand"] }],
      bottles: [
        { id: 1, name: "Speyside", brandId: 1 },
        { id: 2, name: "Highland", brandId: 1 },
      ],
      releases: [{ id: 10, bottleId: 2, edition: "Batch 1" }],
      aliases: [
        { name: "Shieldaig Speyside Batch 1", bottleId: 1, releaseId: 10 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["aliases", 0, "releaseId"],
        message: "Release 10 does not belong to bottle 1.",
      });
    }
  });

  test("rejects removed structured cask fields on catalog rows", () => {
    const result = LocalCatalogSchema.safeParse({
      entities: [{ id: 1, name: "Shieldaig", type: ["brand"] }],
      bottles: [{ id: 1, name: "Speyside", brandId: 1, caskType: "Sherry" }],
    });

    expect(result.success).toBe(false);
  });

  test("derives initial candidates and sibling context from catalog rows", async () => {
    const dataSource = createLocalCatalogDataSource(shieldaigCatalog);

    const candidates = await dataSource.findInitialCandidates?.({
      reference: {
        name: "Shieldaig Speyside Single Malt 21-year-old Scotch Whisky",
      },
      extractedIdentity: {
        brand: "Shieldaig",
        bottler: null,
        expression: "Speyside",
        series: null,
        distillery: [],
        category: "single_malt",
        stated_age: 21,
        abv: null,
        release_year: null,
        vintage_year: null,
        cask_strength: null,
        single_cask: null,
        edition: null,
      },
    });

    expect(candidates?.map((candidate) => candidate.bottleId)).toEqual([
      44175, 44266,
    ]);
    expect(candidates?.[0]).toMatchObject({
      fullName: "Shieldaig Speyside",
      statedAge: 18,
      familyContext: {
        siblingBottles: [
          {
            bottleId: 44266,
            fullName: "Shieldaig Speyside 30-year-old",
            statedAge: 30,
          },
        ],
      },
    });
  });

  test("uses aliases for exact local search matches", async () => {
    const dataSource = createLocalCatalogDataSource(shieldaigCatalog);

    const candidates = await dataSource.searchBottles(
      BottleCandidateSearchInputSchema.parse({
        query: "Shieldaig Speyside",
        limit: 5,
      }),
    );

    expect(candidates[0]).toMatchObject({
      bottleId: 44175,
      alias: "Shieldaig Speyside",
      source: expect.arrayContaining(["exact"]),
      score: 1,
    });
  });

  test("hydrates candidates by id", async () => {
    const dataSource = createLocalCatalogDataSource(shieldaigCatalog);

    await expect(
      dataSource.getBottleCandidateById?.(44266, null),
    ).resolves.toMatchObject({
      bottleId: 44266,
      fullName: "Shieldaig Speyside 30-year-old",
      source: ["current"],
    });
  });

  test("searches catalog entities", async () => {
    const dataSource = createLocalCatalogDataSource(shieldaigCatalog);

    await expect(
      dataSource.searchEntities?.({
        query: "Shieldaig",
        type: "brand",
        limit: 5,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        entityId: 3943,
        name: "Shieldaig",
        score: 1,
      }),
    ]);
  });
});
