import { db } from "@peated/server/db";
import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() =>
    caller.bottleUpdate({
      bottle: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("requires mod", async () => {
  const caller = createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.bottleUpdate({
      bottle: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("no changes", async () => {
  const bottle = await Fixtures.Bottle();

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(bottle).toEqual(newBottle);
});

test("edits a new bottle with new name param", async () => {
  const brand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({ brandId: brand.id });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    name: "Delicious Wood",
  });

  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "name", "fullName")).toEqual(
    omit(bottle2, "name", "fullName"),
  );
  expect(bottle2.name).toBe("Delicious Wood");
  expect(bottle2.fullName).toBe(`${brand.name} ${bottle2.name}`);
});

test("clears category", async () => {
  const bottle = await Fixtures.Bottle({ category: "single_malt" });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    category: null,
  });

  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "category")).toEqual(omit(bottle2, "category"));
  expect(bottle2.category).toBe(null);
});

test("manipulates name to conform with age", async () => {
  const brand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({ brandId: brand.id });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    name: "Delicious 10",
    statedAge: 10,
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(omit(bottle, "name", "fullName", "statedAge")).toEqual(
    omit(bottle2, "name", "fullName", "statedAge"),
  );
  expect(bottle2.statedAge).toBe(10);
  expect(bottle2.name).toBe("Delicious 10-year-old");
  expect(bottle2.fullName).toBe(`${brand.name} ${bottle2.name}`);
});

test("fills in statedAge", async () => {
  const brand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({ brandId: brand.id });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    name: "Delicious 10-year-old",
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(omit(bottle, "name", "fullName", "statedAge")).toEqual(
    omit(bottle2, "name", "fullName", "statedAge"),
  );
  expect(bottle2.statedAge).toBe(10);
});

test("changes brand", async () => {
  const newBrand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle();

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    brand: newBrand.id,
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(omit(bottle, "brandId", "fullName")).toEqual(
    omit(bottle2, "brandId", "fullName"),
  );
  expect(bottle2.brandId).toBe(newBrand.id);
  expect(bottle2.fullName).toBe(`${newBrand.name} ${bottle.name}`);

  const newBrandRef = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, newBrand.id),
  });
  expect(newBrandRef?.totalBottles).toBe(1);

  const oldBrand = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, bottle.brandId),
  });
  expect(oldBrand?.totalBottles).toBe(0);
});

test("removes distiller", async () => {
  const distillerA = await Fixtures.Entity();
  const distillerB = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({
    distillerIds: [distillerA.id, distillerB.id],
  });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    distillers: [distillerA.id],
  });

  const results = await db
    .select({
      distillerId: bottlesToDistillers.distillerId,
    })
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(results.length).toEqual(1);
  expect(results[0].distillerId).toEqual(distillerA.id);

  const newDistillerB = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, distillerB.id),
  });
  expect(newDistillerB?.totalBottles).toBe(0);
});

test("changes distiller", async () => {
  const distillerA = await Fixtures.Entity();
  const distillerB = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({
    distillerIds: [distillerA.id],
  });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    distillers: [distillerB.id],
  });

  const newDistillerA = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, distillerA.id),
  });
  expect(newDistillerA?.totalBottles).toBe(0);

  const newDistillerB = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, distillerB.id),
  });
  expect(newDistillerB?.totalBottles).toBe(1);
});

test("changes bottler", async () => {
  const bottlerA = await Fixtures.Entity();
  const bottlerB = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({
    bottlerId: bottlerA.id,
  });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    bottler: bottlerB.id,
  });

  const newBottlerA = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, bottlerA.id),
  });
  expect(newBottlerA?.totalBottles).toBe(0);

  const newBottlerB = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, bottlerB.id),
  });
  expect(newBottlerB?.totalBottles).toBe(1);
});

test("changes distiller with previous identical brand", async () => {
  const entityA = await Fixtures.Entity();
  const entityB = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({
    brandId: entityA.id,
    distillerIds: [entityA.id],
  });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    brand: entityA.id,
    distillers: [entityB.id],
  });

  const newEntityA = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityA.id),
  });
  expect(newEntityA?.totalBottles).toBe(1);

  const newEntityB = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityB.id),
  });
  expect(newEntityB?.totalBottles).toBe(1);
});
