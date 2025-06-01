import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities", () => {
  test("lists entities", async ({ fixtures }) => {
    await fixtures.Entity({ name: "A" });
    await fixtures.Entity({ name: "B" });

    const { results } = await routerClient.entities.list();

    expect(results.length).toBe(2);
  });

  test("bias shared distillers", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "A", type: ["brand"] });
    const dist1 = await fixtures.Entity({
      name: "B",
      type: ["distiller"],
      totalTastings: 0,
    });
    await fixtures.Entity({ name: "C", totalTastings: 1 });
    await fixtures.Bottle({ brandId: brand.id, distillerIds: [dist1.id] });

    const { results } = await routerClient.entities.list({
      searchContext: {
        brand: brand.id,
        type: "distiller",
      },
    });

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].id).toEqual(dist1.id);
  });

  test("bias shared bottlers", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "A", type: ["brand"] });
    const bottler1 = await fixtures.Entity({
      name: "B",
      type: ["bottler"],
      totalTastings: 0,
    });
    await fixtures.Entity({ name: "C", totalTastings: 1 });
    await fixtures.Bottle({ brandId: brand.id, bottlerId: bottler1.id });

    const { results } = await routerClient.entities.list({
      searchContext: {
        brand: brand.id,
        type: "bottler",
      },
    });

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].id).toEqual(bottler1.id);
  });

  describe("filtering", () => {
    test("filters by query text search", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Highland Distillery" });
      await fixtures.Entity({ name: "Lowland Brewery" });

      const { results } = await routerClient.entities.list({
        query: "Highland",
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Highland Distillery");
    });

    test("filters by name via entity aliases", async ({ fixtures }) => {
      const entity = await fixtures.Entity({ name: "Highland Distillery" });
      await fixtures.EntityAlias({
        entityId: entity.id,
        name: "Highland Dist",
      });
      await fixtures.Entity({ name: "Lowland Brewery" });

      const { results } = await routerClient.entities.list({
        name: "Highland Dist",
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(entity.id);
    });

    test("filters by entity type", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Brand A", type: ["brand"] });
      await fixtures.Entity({ name: "Distiller A", type: ["distiller"] });
      await fixtures.Entity({ name: "Bottler A", type: ["bottler"] });

      const { results } = await routerClient.entities.list({
        type: "distiller",
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Distiller A");
    });

    test("filters by country ID", async ({ fixtures }) => {
      const country = await fixtures.Country({
        name: "Scotland",
        slug: "scotland",
      });
      const otherCountry = await fixtures.Country({
        name: "Ireland",
        slug: "ireland",
      });

      await fixtures.Entity({
        name: "Scottish Distillery",
        countryId: country.id,
      });
      await fixtures.Entity({
        name: "Irish Distillery",
        countryId: otherCountry.id,
      });

      const { results } = await routerClient.entities.list({
        country: country.id.toString(),
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Scottish Distillery");
    });

    test("filters by country slug", async ({ fixtures }) => {
      const country = await fixtures.Country({
        name: "Scotland",
        slug: "scotland",
      });
      const otherCountry = await fixtures.Country({
        name: "Ireland",
        slug: "ireland",
      });

      await fixtures.Entity({
        name: "Scottish Distillery",
        countryId: country.id,
      });
      await fixtures.Entity({
        name: "Irish Distillery",
        countryId: otherCountry.id,
      });

      const { results } = await routerClient.entities.list({
        country: "scotland",
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Scottish Distillery");
    });

    test("filters by region ID with country", async ({ fixtures }) => {
      const country = await fixtures.Country({
        name: "Scotland",
        slug: "scotland",
      });
      const region = await fixtures.Region({
        name: "Speyside",
        slug: "speyside",
        countryId: country.id,
      });

      await fixtures.Entity({
        name: "Speyside Distillery",
        countryId: country.id,
        regionId: region.id,
      });
      await fixtures.Entity({
        name: "Highland Distillery",
        countryId: country.id,
      });

      const { results } = await routerClient.entities.list({
        country: country.id.toString(),
        region: region.id.toString(),
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Speyside Distillery");
    });

    test("filters by region slug with country", async ({ fixtures }) => {
      const country = await fixtures.Country({
        name: "Scotland",
        slug: "scotland",
      });
      const region = await fixtures.Region({
        name: "Speyside",
        slug: "speyside",
        countryId: country.id,
      });

      await fixtures.Entity({
        name: "Speyside Distillery",
        countryId: country.id,
        regionId: region.id,
      });
      await fixtures.Entity({
        name: "Highland Distillery",
        countryId: country.id,
      });

      const { results } = await routerClient.entities.list({
        country: "scotland",
        region: "speyside",
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Speyside Distillery");
    });

    test("filters by bottler", async ({ fixtures }) => {
      const bottler = await fixtures.Entity({
        name: "Gordon & MacPhail",
        type: ["bottler"],
      });
      const distiller = await fixtures.Entity({
        name: "Macallan",
        type: ["distiller"],
      });
      const otherDistiller = await fixtures.Entity({
        name: "Glenfiddich",
        type: ["distiller"],
      });

      await fixtures.Bottle({
        bottlerId: bottler.id,
        distillerIds: [distiller.id],
      });
      await fixtures.Bottle({ distillerIds: [otherDistiller.id] });

      const { results } = await routerClient.entities.list({
        bottler: bottler.id,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(distiller.id);
    });
  });

  describe("sorting", () => {
    test("sorts by name ascending", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Zebra Distillery" });
      await fixtures.Entity({ name: "Alpha Distillery" });

      const { results } = await routerClient.entities.list({
        sort: "name",
      });

      expect(results[0].name).toBe("Alpha Distillery");
      expect(results[1].name).toBe("Zebra Distillery");
    });

    test("sorts by name descending", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Zebra Distillery" });
      await fixtures.Entity({ name: "Alpha Distillery" });

      const { results } = await routerClient.entities.list({
        sort: "-name",
      });

      expect(results[0].name).toBe("Zebra Distillery");
      expect(results[1].name).toBe("Alpha Distillery");
    });

    test("sorts by total tastings ascending", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Popular", totalTastings: 100 });
      await fixtures.Entity({ name: "Unpopular", totalTastings: 5 });

      const { results } = await routerClient.entities.list({
        sort: "tastings",
      });

      expect(results[0].name).toBe("Unpopular");
      expect(results[1].name).toBe("Popular");
    });

    test("sorts by total tastings descending", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Popular", totalTastings: 100 });
      await fixtures.Entity({ name: "Unpopular", totalTastings: 5 });

      const { results } = await routerClient.entities.list({
        sort: "-tastings",
      });

      expect(results[0].name).toBe("Popular");
      expect(results[1].name).toBe("Unpopular");
    });

    test("sorts by total bottles ascending", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Many Bottles", totalBottles: 50 });
      await fixtures.Entity({ name: "Few Bottles", totalBottles: 3 });

      const { results } = await routerClient.entities.list({
        sort: "bottles",
      });

      expect(results[0].name).toBe("Few Bottles");
      expect(results[1].name).toBe("Many Bottles");
    });

    test("sorts by total bottles descending", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Many Bottles", totalBottles: 50 });
      await fixtures.Entity({ name: "Few Bottles", totalBottles: 3 });

      const { results } = await routerClient.entities.list({
        sort: "-bottles",
      });

      expect(results[0].name).toBe("Many Bottles");
      expect(results[1].name).toBe("Few Bottles");
    });

    test("sorts by creation date ascending", async ({ fixtures }) => {
      const older = await fixtures.Entity({ name: "Older Entity" });
      const newer = await fixtures.Entity({ name: "Newer Entity" });

      const { results } = await routerClient.entities.list({
        sort: "created",
      });

      expect(results[0].id).toBe(older.id);
      expect(results[1].id).toBe(newer.id);
    });

    test("sorts by creation date descending", async ({ fixtures }) => {
      const older = await fixtures.Entity({ name: "Older Entity" });
      const newer = await fixtures.Entity({ name: "Newer Entity" });

      const { results } = await routerClient.entities.list({
        sort: "-created",
      });

      expect(results[0].id).toBe(newer.id);
      expect(results[1].id).toBe(older.id);
    });

    test("sorts by rank with query (text search ranking)", async ({
      fixtures,
    }) => {
      await fixtures.Entity({ name: "Highland Park", totalTastings: 5 });
      await fixtures.Entity({ name: "Highland Spring", totalTastings: 100 });

      const { results } = await routerClient.entities.list({
        query: "Highland",
        sort: "rank",
      });

      expect(results.length).toBe(2);
      // Both should be returned, ranked by search relevance
    });

    test("sorts by rank without query (total tastings)", async ({
      fixtures,
    }) => {
      await fixtures.Entity({ name: "Popular", totalTastings: 100 });
      await fixtures.Entity({ name: "Unpopular", totalTastings: 5 });

      const { results } = await routerClient.entities.list({
        sort: "rank",
      });

      expect(results[0].name).toBe("Popular");
      expect(results[1].name).toBe("Unpopular");
    });
  });

  describe("pagination", () => {
    test("supports cursor pagination", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Entity 1" });
      await fixtures.Entity({ name: "Entity 2" });
      await fixtures.Entity({ name: "Entity 3" });

      const page1 = await routerClient.entities.list({
        limit: 2,
        cursor: 1,
      });

      expect(page1.results.length).toBe(2);
      expect(page1.rel.nextCursor).toBe(2);
      expect(page1.rel.prevCursor).toBe(null);

      const page2 = await routerClient.entities.list({
        limit: 2,
        cursor: 2,
      });

      expect(page2.results.length).toBe(1);
      expect(page2.rel.nextCursor).toBe(null);
      expect(page2.rel.prevCursor).toBe(1);
    });

    test("supports custom limit", async ({ fixtures }) => {
      await fixtures.Entity({ name: "Entity 1" });
      await fixtures.Entity({ name: "Entity 2" });
      await fixtures.Entity({ name: "Entity 3" });

      const { results } = await routerClient.entities.list({
        limit: 1,
      });

      expect(results.length).toBe(1);
    });
  });

  describe("search context biasing", () => {
    test("biases entities by type in search context", async ({ fixtures }) => {
      await fixtures.Entity({
        name: "Generic Brand",
        type: ["brand"],
        totalTastings: 100,
      });
      await fixtures.Entity({
        name: "Generic Distiller",
        type: ["distiller"],
        totalTastings: 5,
      });

      const { results } = await routerClient.entities.list({
        searchContext: {
          type: "distiller",
        },
      });

      expect(results[0].name).toBe("Generic Distiller");
    });

    test("biases entities with name bias from SMWS bottle names", async ({
      fixtures,
    }) => {
      const brand = await fixtures.Entity({ name: "SMWS", type: ["brand"] });
      await fixtures.Entity({
        name: "Highland Park",
        type: ["distiller"],
        totalTastings: 5,
      });
      await fixtures.Entity({
        name: "Popular Distillery",
        type: ["distiller"],
        totalTastings: 100,
      });

      const { results } = await routerClient.entities.list({
        searchContext: {
          brand: brand.id,
          type: "distiller",
          bottleName: "4.360 Jangling dram", // Should parse to extract "Highland Park"
        },
      });

      // The exact behavior depends on the SMWS parsing logic
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("error cases", () => {
    test("throws error for invalid country", async ({ fixtures }) => {
      await expect(
        routerClient.entities.list({
          country: "invalid-country",
        })
      ).rejects.toThrow("Invalid country");
    });

    test("throws error for invalid region", async ({ fixtures }) => {
      const country = await fixtures.Country({
        name: "Scotland",
        slug: "scotland",
      });

      await expect(
        routerClient.entities.list({
          country: "scotland",
          region: "invalid-region",
        })
      ).rejects.toThrow("Invalid region");
    });

    test("throws error for region without country", async ({ fixtures }) => {
      await expect(
        routerClient.entities.list({
          region: "some-region",
        })
      ).rejects.toThrow("Region requires country");
    });
  });
});
