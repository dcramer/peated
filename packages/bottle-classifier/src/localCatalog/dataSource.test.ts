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
      maturation: "Oloroso hogshead",
      caskNumber: "#1234",
      outturn: 240,
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

  test("preserves producer-stated cask details on catalog rows", () => {
    const result = LocalCatalogSchema.parse({
      entities: [{ id: 1, name: "Shieldaig", type: ["brand"] }],
      bottles: [
        {
          id: 1,
          name: "Speyside",
          brandId: 1,
          maturation: "Oloroso hogshead",
          caskNumber: "#1234",
          outturn: 240,
        },
      ],
    });

    expect(result.bottles[0]).toMatchObject({
      maturation: "Oloroso hogshead",
      caskNumber: "#1234",
      outturn: 240,
    });
  });

  test("keeps cask details out of local text scores", async () => {
    const dataSource = createLocalCatalogDataSource(
      LocalCatalogSchema.parse({
        entities: [{ id: 1, name: "Example", type: ["brand"] }],
        bottles: [
          {
            id: 1,
            name: "Oloroso Cask",
            brandId: 1,
            maturation: "Oloroso hogshead",
            caskNumber: "#1234",
            outturn: 240,
          },
          {
            id: 2,
            name: "Bourbon Cask",
            brandId: 1,
            maturation: "First-fill bourbon barrel",
            caskNumber: "#5678",
            outturn: 180,
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
        maturation: "Oloroso hogshead",
        cask_number: "#1234",
        outturn: 240,
      }),
    );

    expect(withCaskMetadata).toEqual(baseline);
    expect(withCaskMetadata).toEqual([
      expect.objectContaining({ bottleId: 2, score: 0.4 }),
      expect.objectContaining({
        bottleId: 1,
        score: 0.4,
        maturation: "Oloroso hogshead",
        caskNumber: "#1234",
        outturn: 240,
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
        maturation: null,
        cask_number: null,
        outturn: null,
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
            traitFields: ["statedAge", "releaseYear", "caskNumber"],
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

  test("returns an exact entity identity without the requested role", async () => {
    const dataSource = createLocalCatalogDataSource({
      ...shieldaigCatalog,
      entities: [
        ...shieldaigCatalog.entities,
        {
          id: 1383,
          name: "Suntory",
          shortName: null,
          aliases: [],
          type: ["brand", "distiller"],
        },
      ],
    });

    await expect(
      dataSource.searchEntities?.({
        query: "Suntory",
        type: "bottler",
        limit: 5,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        entityId: 1383,
        type: ["brand", "distiller"],
        source: ["local_catalog", "exact"],
      }),
    ]);

    await expect(
      dataSource.searchEntities?.({
        query: "Suntory Holdings",
        type: "bottler",
        limit: 5,
      }),
    ).resolves.toEqual([]);
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
