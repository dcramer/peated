import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists bottles", async () => {
  await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList();

  expect(results.length).toBe(2);
});

test("lists bottles with query", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList({
    query: "wood",
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with 'The' prefix", async () => {
  const brand = await Fixtures.Entity({ name: "The Macallan" });
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    brandId: brand.id,
  });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList({
    query: "Macallan",
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with distiller", async () => {
  const distiller1 = await Fixtures.Entity();
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    distillerIds: [distiller1.id],
  });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList({
    distiller: distiller1.id,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with brand", async () => {
  const brand1 = await Fixtures.Entity();
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    brandId: brand1.id,
  });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList({
    brand: brand1.id,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with bottler", async () => {
  const bottler = await Fixtures.Entity({
    type: ["bottler"],
  });
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    bottlerId: bottler.id,
  });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList({
    bottler: bottler.id,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with query matching brand and name", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood 10-year-old" });
  await Fixtures.Bottle({ name: "Something Else" });

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.bottleList({
    query: "wood 10",
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});
