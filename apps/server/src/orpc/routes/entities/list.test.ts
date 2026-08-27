import { routerClient } from "@peated/server/orpc/router";

describe("GET /entities", () => {
  test("lists Entities across kinds for selectors", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "A Brand", kind: "brand" });
    const distillery = await fixtures.Entity({
      name: "B Distillery",
      kind: "distillery",
    });
    const company = await fixtures.Entity({
      name: "C Company",
      kind: "company",
    });

    const { results } = await routerClient.entities.list({ sort: "name" });

    expect(results.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: brand.id, kind: "brand" },
      { id: distillery.id, kind: "distillery" },
      { id: company.id, kind: "company" },
    ]);
  });

  test("searches every Entity kind", async ({ fixtures }) => {
    const brand = await fixtures.Entity({
      name: "Shared Selector Brand",
      kind: "brand",
    });
    const bottler = await fixtures.Entity({
      name: "Shared Selector Bottler",
      kind: "bottler",
    });
    await fixtures.Entity({ name: "Unrelated Company", kind: "company" });

    const { results } = await routerClient.entities.list({
      query: "Shared Selector",
      sort: "name",
    });

    expect(results.map(({ id }) => id)).toHaveLength(2);
    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([brand.id, bottler.id]),
    );
  });
});
