import { routerClient } from "@peated/server/orpc/router";

describe("Entity kind collections", () => {
  test("lists only the requested kind", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "A Brand", kind: "brand" });
    const distillery = await fixtures.Entity({
      name: "A Distillery",
      kind: "distillery",
    });
    const bottler = await fixtures.Entity({
      name: "A Bottler",
      kind: "bottler",
    });
    const blender = await fixtures.Entity({
      name: "A Blender",
      kind: "blender",
    });
    const company = await fixtures.Entity({
      name: "A Company",
      kind: "company",
    });

    const results = await Promise.all([
      routerClient.brands.list(),
      routerClient.distilleries.list(),
      routerClient.bottlers.list(),
      routerClient.blenders.list(),
      routerClient.companies.list(),
    ]);

    expect(results.map((result) => result.results.map(({ id }) => id))).toEqual(
      [[brand.id], [distillery.id], [bottler.id], [blender.id], [company.id]],
    );
  });

  test("filters a kind collection by query", async ({ fixtures }) => {
    const expected = await fixtures.Entity({
      name: "Highland Brand",
      kind: "brand",
    });
    await fixtures.Entity({ name: "Lowland Brand", kind: "brand" });
    await fixtures.Entity({
      name: "Highland Distillery",
      kind: "distillery",
    });

    const { results } = await routerClient.brands.list({ query: "Highland" });

    expect(results.map(({ id }) => id)).toEqual([expected.id]);
  });

  test("filters a kind collection by location", async ({ fixtures }) => {
    const country = await fixtures.Country({
      name: "Scotland",
      slug: "scotland",
    });
    const expected = await fixtures.Entity({
      name: "Scottish Distillery",
      kind: "distillery",
      countryId: country.id,
    });
    await fixtures.Entity({
      name: "Unknown Distillery",
      kind: "distillery",
    });

    const { results } = await routerClient.distilleries.list({
      country: "scotland",
    });

    expect(results.map(({ id }) => id)).toEqual([expected.id]);
  });

  test("filters a kind collection by current owner", async ({ fixtures }) => {
    const owner = await fixtures.Entity({ kind: "company" });
    const expected = await fixtures.Entity({
      name: "Owned Distillery",
      kind: "distillery",
      ownerId: owner.id,
    });
    await fixtures.Entity({
      name: "Other Distillery",
      kind: "distillery",
    });

    const { results } = await routerClient.distilleries.list({
      owner: owner.id,
    });

    expect(results.map(({ id }) => id)).toEqual([expected.id]);
  });
});
