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
    // Its own line, with no distiller recorded.
    await fixtures.Bottle({
      name: "F",
      vintageYear: 1981,
      brandId: distillery.id,
    });
    // Distilled elsewhere.
    await fixtures.Bottle({ name: "E", vintageYear: 1972 });

    expect(
      await routerClient.entities.about.vintages({ entity: distillery.id }),
    ).toEqual({
      results: [
        { year: 1972, count: 2 },
        { year: 1981, count: 2 },
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
      withoutEntity: 3,
    });
  });

  test("counts release years for every bottle distilled at a distillery", async ({
    fixtures,
  }) => {
    const distillery = await fixtures.Entity({ kind: "distillery" });
    const otherBrand = await fixtures.Entity({ kind: "brand" });
    const otherDistillery = await fixtures.Entity({ kind: "distillery" });
    await fixtures.Bottle({
      name: "Own",
      brandId: distillery.id,
      releaseYear: 2021,
      distillerIds: [distillery.id],
    });
    // An independent bottling sold under another brand still counts.
    await fixtures.Bottle({
      name: "Independent",
      brandId: otherBrand.id,
      releaseYear: 2004,
      distillerIds: [distillery.id],
    });
    // Its own line counts even when no distiller is recorded.
    await fixtures.Bottle({
      name: "Own, no distiller",
      brandId: distillery.id,
      releaseYear: 2021,
    });
    await fixtures.Bottle({ name: "No year", distillerIds: [distillery.id] });
    // Distilled elsewhere, including under its name.
    await fixtures.Bottle({ name: "Elsewhere", releaseYear: 2004 });
    await fixtures.Bottle({
      name: "Sourced",
      brandId: distillery.id,
      releaseYear: 2004,
      distillerIds: [otherDistillery.id],
    });

    expect(
      await routerClient.entities.about.releaseYears({ entity: distillery.id }),
    ).toEqual({
      results: [
        { year: 2004, count: 1 },
        { year: 2021, count: 2 },
      ],
      withoutYear: 1,
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

  test("counts what a bottler bottled, under any label", async ({
    fixtures,
  }) => {
    const bottler = await fixtures.Entity({ kind: "bottler" });
    const label = await fixtures.Entity({ kind: "brand" });
    const otherBottler = await fixtures.Entity({ kind: "bottler" });
    const ardbeg = await fixtures.Entity({
      kind: "distillery",
      name: "Ardbeg",
    });
    const caolIla = await fixtures.Entity({
      kind: "distillery",
      name: "Caol Ila",
    });
    await fixtures.Bottle({
      name: "Own label",
      brandId: bottler.id,
      bottlerId: bottler.id,
      releaseYear: 2021,
      distillerIds: [ardbeg.id],
    });
    // A range sold under its own label still counts for the bottler.
    await fixtures.Bottle({
      name: "Range",
      brandId: label.id,
      bottlerId: bottler.id,
      releaseYear: 2020,
      distillerIds: [caolIla.id],
    });
    // Bottled by someone else.
    await fixtures.Bottle({
      name: "Elsewhere",
      bottlerId: otherBottler.id,
      releaseYear: 2020,
      distillerIds: [ardbeg.id],
    });

    expect(
      await routerClient.entities.about.releaseYears({ entity: bottler.id }),
    ).toEqual({
      results: [
        { year: 2020, count: 1 },
        { year: 2021, count: 1 },
      ],
      withoutYear: 0,
    });
    expect(
      await routerClient.entities.about.distillers({ entity: bottler.id }),
    ).toEqual({
      results: [
        {
          entity: { id: ardbeg.id, name: "Ardbeg", kind: "distillery" },
          count: 1,
        },
        {
          entity: { id: caolIla.id, name: "Caol Ila", kind: "distillery" },
          count: 1,
        },
      ],
      withoutEntity: 0,
    });
  });

  test("returns 404 for a missing entity", async () => {
    const err = await waitError(() =>
      routerClient.entities.about.vintages({ entity: 123456789 }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
