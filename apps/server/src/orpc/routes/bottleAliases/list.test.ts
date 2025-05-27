import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottle-aliases", () => {
  test("lists bottle aliases for bottle", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Brand" });
    const bottle = await fixtures.Bottle({ name: "Foo", brandId: brand.id });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Foo Bar",
    });

    const { results } = await routerClient.bottleAliases.list({
      bottle: bottle.id,
    });
    expect(results.length).toEqual(2);
    expect(results[0].name).toEqual("Brand Foo");
    expect(results[0].isCanonical).toEqual(true);
    expect(results[1].name).toEqual("Foo Bar");
    expect(results[1].isCanonical).toEqual(false);
  });

  test("lists unmatched aliases", async ({ fixtures }) => {
    await fixtures.BottleAlias({ name: "Foo", bottleId: null });

    const { results } = await routerClient.bottleAliases.list({
      onlyUnknown: true,
    });
    expect(results.length).toEqual(1);
    expect(results[0].name).toEqual("Foo");
    expect(results[0].isCanonical).toBeUndefined();
  });
});
