import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("About catalog numbers", () => {
  test("counts vintages and bottlers for a distillery", async ({
    fixtures,
  }) => {
    const distillery = await fixtures.Entity({ kind: "distillery" });
    const bottler = await fixtures.Entity({
      kind: "bottler",
      name: "Signatory",
    });
    await fixtures.Bottle({
      name: "A",
      vintageYear: 1972,
      distillerIds: [distillery.id],
      bottlerId: bottler.id,
    });
    await fixtures.Bottle({
      name: "B",
      vintageYear: 1972,
      distillerIds: [distillery.id],
      bottlerId: bottler.id,
    });
    await fixtures.Bottle({
      name: "C",
      vintageYear: 1981,
      distillerIds: [distillery.id],
    });
    await fixtures.Bottle({ name: "D", distillerIds: [distillery.id] });
    // Distilled elsewhere.
    await fixtures.Bottle({ name: "E", vintageYear: 1972 });

    expect(
      await routerClient.entities.about.vintages({ entity: distillery.id }),
    ).toEqual({
      results: [
        { year: 1972, count: 2 },
        { year: 1981, count: 1 },
      ],
      withoutYear: 1,
    });

    expect(
      await routerClient.entities.about.bottlers({ entity: distillery.id }),
    ).toEqual({
      results: [
        {
          entity: { id: bottler.id, name: "Signatory", kind: "bottler" },
          count: 2,
        },
      ],
      withoutEntity: 2,
    });
  });

  test("counts distilleries and release years for a brand", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ kind: "brand" });
    const distillery = await fixtures.Entity({
      kind: "distillery",
      name: "Cardhu",
    });
    await fixtures.Bottle({
      name: "A",
      brandId: brand.id,
      releaseYear: 2020,
      distillerIds: [distillery.id],
    });
    await fixtures.Bottle({ name: "B", brandId: brand.id });

    expect(
      await routerClient.entities.about.distillers({ entity: brand.id }),
    ).toEqual({
      results: [
        {
          entity: { id: distillery.id, name: "Cardhu", kind: "distillery" },
          count: 1,
        },
      ],
      withoutEntity: 1,
    });
    expect(
      await routerClient.entities.about.releaseYears({ entity: brand.id }),
    ).toEqual({ results: [{ year: 2020, count: 1 }], withoutYear: 1 });
  });

  test("returns 404 for a missing entity", async () => {
    const err = await waitError(() =>
      routerClient.entities.about.vintages({ entity: 123456789 }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
