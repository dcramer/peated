import { createCaller } from "../router";

test("lists entities", async ({ fixtures }) => {
  await fixtures.Entity();
  await fixtures.Entity();

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});

test("bias shared distillers", async ({ fixtures }) => {
  const brand = await fixtures.Entity({ type: ["brand"] });
  const dist1 = await fixtures.Entity({
    type: ["distiller"],
    totalTastings: 0,
  });
  await fixtures.Entity({ totalTastings: 1 });
  await fixtures.Bottle({ brandId: brand.id, distillerIds: [dist1.id] });

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList({
    searchContext: {
      brand: brand.id,
      type: "distiller",
    },
  });

  expect(results.length).toBeGreaterThanOrEqual(3);
  expect(results[0].id).toEqual(dist1.id);
});

test("bias shared bottlers", async ({ fixtures }) => {
  const brand = await fixtures.Entity({ type: ["brand"] });
  const bottler1 = await fixtures.Entity({
    type: ["bottler"],
    totalTastings: 0,
  });
  await fixtures.Entity({ totalTastings: 1 });
  await fixtures.Bottle({ brandId: brand.id, bottlerId: bottler1.id });

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList({
    searchContext: {
      brand: brand.id,
      type: "bottler",
    },
  });

  expect(results.length).toBeGreaterThanOrEqual(3);
  expect(results[0].id).toEqual(bottler1.id);
});
