import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles", () => {
  test("lists bottles", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Delicious Wood" });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({});

    expect(results.length).toBe(2);
  });

  test("lists bottles with query", async ({ fixtures }) => {
    const bottle1 = await fixtures.Bottle({ name: "Delicious Wood" });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      query: "wood",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with 'The' prefix", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "The Macallan" });
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: brand.id,
    });

    const { results } = await routerClient.bottles.list({
      query: "Macallan",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with distiller", async ({ fixtures }) => {
    const distiller1 = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      distillerIds: [distiller1.id],
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      distiller: distiller1.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with brand", async ({ fixtures }) => {
    const brand1 = await fixtures.Entity();
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      brandId: brand1.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      brand: brand1.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with bottler", async ({ fixtures }) => {
    const bottler = await fixtures.Entity({
      type: ["bottler"],
    });
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      bottlerId: bottler.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      bottler: bottler.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with query matching brand and name", async ({
    fixtures,
  }) => {
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood 10-year-old",
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      query: "wood 10",
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });

  test("lists bottles with series", async ({ fixtures }) => {
    const series = await fixtures.BottleSeries({ name: "Limited Edition" });
    const bottle1 = await fixtures.Bottle({
      name: "Delicious Wood",
      seriesId: series.id,
    });
    await fixtures.Bottle({ name: "Something Else" });

    const { results } = await routerClient.bottles.list({
      series: series.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(bottle1.id);
  });
});
