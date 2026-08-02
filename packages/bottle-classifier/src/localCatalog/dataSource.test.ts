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
      groupId: 1001,
      category: "single_malt",
      statedAge: 18,
    },
    {
      id: 44266,
      name: "Speyside 30-year-old",
      fullName: "Shieldaig Speyside 30-year-old",
      brandId: 3943,
      groupId: 1001,
      category: "single_malt",
      statedAge: 30,
      releaseYear: 2024,
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
    },
  ],
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

  test("rejects aliases pointing at an unknown Bottle", () => {
    const result = LocalCatalogSchema.safeParse({
      entities: [{ id: 1, name: "Shieldaig", type: ["brand"] }],
      bottles: [{ id: 1, name: "Speyside", brandId: 1 }],
      aliases: [{ name: "Shieldaig Highland", bottleId: 2 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["aliases", 0, "bottleId"],
        message: "Unknown bottle id 2.",
      });
    }
  });

  test("preserves canonical structured cask fields on catalog rows", () => {
    const result = LocalCatalogSchema.parse({
      entities: [{ id: 1, name: "Shieldaig", type: ["brand"] }],
      bottles: [
        {
          id: 1,
          name: "Speyside",
          brandId: 1,
          caskType: "oloroso",
          caskSize: "hogshead",
          caskFill: "1st_fill",
        },
      ],
    });

    expect(result.bottles[0]).toMatchObject({
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
    });
  });

  test("keeps optional cask metadata out of local candidate scores", async () => {
    const dataSource = createLocalCatalogDataSource(
      LocalCatalogSchema.parse({
        entities: [{ id: 1, name: "Example", type: ["brand"] }],
        bottles: [
          {
            id: 1,
            name: "Oloroso Cask",
            brandId: 1,
            caskType: "oloroso",
            caskSize: "hogshead",
            caskFill: "1st_fill",
          },
          {
            id: 2,
            name: "Bourbon Cask",
            brandId: 1,
            caskType: "bourbon",
            caskSize: "barrel",
            caskFill: "refill",
          },
        ],
        aliases: [],
      }),
    );

    const baseline = await dataSource.searchBottles(
      BottleCandidateSearchInputSchema.parse({ brand: "Example" }),
    );
    const withCaskMetadata = await dataSource.searchBottles(
      BottleCandidateSearchInputSchema.parse({
        brand: "Example",
        cask_type: "oloroso",
        cask_size: "hogshead",
        cask_fill: "1st_fill",
      }),
    );

    expect(withCaskMetadata).toEqual(baseline);
    expect(withCaskMetadata).toEqual([
      expect.objectContaining({ bottleId: 2, score: 0.4 }),
      expect.objectContaining({
        bottleId: 1,
        score: 0.4,
        caskType: "oloroso",
        caskSize: "hogshead",
        caskFill: "1st_fill",
      }),
    ]);
  });

  test("derives sibling context from explicit group membership", async () => {
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
        cask_type: null,
        cask_size: null,
        cask_fill: null,
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
            releaseYear: 2024,
            traitFields: ["statedAge", "releaseYear"],
          },
        ],
      },
    });
  });

  test("does not infer sibling context from similar Bottle names", async () => {
    const catalog = LocalCatalogSchema.parse({
      entities: [{ id: 1, name: "Example", type: ["brand"] }],
      bottles: [
        {
          id: 1,
          name: "Core 18-year-old",
          brandId: 1,
          statedAge: 18,
        },
        {
          id: 2,
          name: "Core 30-year-old",
          brandId: 1,
          statedAge: 30,
        },
      ],
      aliases: [],
    });
    const dataSource = createLocalCatalogDataSource(catalog);

    await expect(dataSource.getBottleCandidateById?.(1)).resolves.toMatchObject(
      {
        bottleId: 1,
        familyContext: {
          siblingBottles: [],
        },
      },
    );
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
      dataSource.getBottleCandidateById?.(44266),
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

    await expect(
      dataSource.searchEntities?.({
        query: "North Shieldaig Distillery",
        type: "brand",
        limit: 5,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        entityId: 3943,
        name: "Shieldaig",
        score: expect.any(Number),
      }),
    ]);
  });

  test("ranks more specific contained entity candidates first", async () => {
    const dataSource = createLocalCatalogDataSource({
      ...shieldaigCatalog,
      entities: [
        ...shieldaigCatalog.entities,
        {
          id: 5001,
          name: "Northstar",
          shortName: null,
          aliases: [],
          type: ["distiller"],
        },
        {
          id: 5002,
          name: "Northstar Distillery",
          shortName: null,
          aliases: [],
          type: ["distiller"],
        },
      ],
    });

    const results = await dataSource.searchEntities?.({
      query: "Northstar Distillery Co.",
      type: "distiller",
      limit: 5,
    });

    expect(results?.map((result) => result.entityId)).toEqual([5002, 5001]);
    expect(results?.[0]?.score).toBeGreaterThan(results?.[1]?.score ?? 0);
  });

  test("resolves exact entity aliases ahead of contained names", async () => {
    const dataSource = createLocalCatalogDataSource({
      ...shieldaigCatalog,
      entities: [
        ...shieldaigCatalog.entities,
        {
          id: 1953,
          name: "Komagatake",
          shortName: null,
          aliases: ["Mars Shinshu Distillery"],
          type: ["brand", "distiller"],
        },
        {
          id: 238555,
          name: "Shinshu",
          shortName: null,
          aliases: [],
          type: ["distiller"],
        },
      ],
    });

    await expect(
      dataSource.searchEntities?.({
        query: "Mars Shinshu Distillery",
        type: "distiller",
        limit: 5,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        entityId: 1953,
        alias: "Mars Shinshu Distillery",
        score: 1,
        source: ["local_catalog", "exact"],
      }),
      expect.objectContaining({
        entityId: 238555,
        score: expect.any(Number),
      }),
    ]);
  });
});
